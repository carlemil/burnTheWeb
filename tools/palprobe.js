// Headless probe for palette DELETION — which palette everything lands on afterwards.
//
// Deleting is the one palette operation that can strand you: shipped ramps only tombstone
// (they stay in PALETTES so saved scenes keep rendering) while customs really go, indices
// are the wire format, and the in-use set is indices too. The bug this probe exists for:
// with Fire deleted and the in-use set narrowed, deleting the palette you were on landed
// back on Fire — a palette already deleted and no longer in the strip.
//
// Slices the REAL helpers out of the built file, so it tests the shipped code.
// Usage: node tools/palprobe.js dev-index.html
//
// Slices by source markers, so keep them: `let palGone = new Set();` … `function palGoneOk(`
// and `function palRemapOne(` … `function palRemapDeleted(`.
const fs = require("fs");
const html = fs.readFileSync(process.argv[2] || "dev-index.html", "utf8");
const s0 = html.indexOf("<script>"), s1 = html.indexOf("</script>", s0);
if (s0 < 0 || s1 < 0) throw new Error("probe: no inline <script> found");
const src = html.slice(s0 + 8, s1);

const cut = (from, to) => {
  const a = src.indexOf(from), b = src.indexOf(to, a + 1);
  if (a < 0 || b < 0 || b < a) throw new Error("probe: could not slice " + from + " .. " + to);
  return src.slice(a, b);
};

// PALETTES is stubbed down to what these helpers touch — the name (display order) and
// whether it is custom. Deliberately NOT in alphabetical array order: the display order and
// the array order must be allowed to disagree, which is the whole point of palByName.
const stub = `
  let PALETTES = [];
  let palUse = null;
  const PAL_BUILTIN = 4;
  function setUp(names, use, gone) {
    PALETTES = names.map(n => ({ name: n, custom: false }));
    palUse = use === null ? null : new Set(use);
    palGone = new Set(gone || []);
  }
`;
const P = new Function(stub
  + cut("  let palGone = new Set();", "  function palGoneOk(")
  + cut("  function palRemapOne(", "  function palRemapDeleted(")
  + "\nreturn { setUp, palFallbackFor, palInUse, palByName, palKeepInUse, palRemapOne, palAliveCount,"
  + "  names: () => PALETTES.map(p => p.name), use: () => (palUse ? [...palUse].sort((a,b)=>a-b) : null),"
  + "  nameAt: i => (PALETTES[i] || {}).name };")();

let pass = 0, fail = 0;
const ok = (cond, name, detail) => {
  (cond ? pass++ : fail++);
  console.log((cond ? "PASS  " : "FAIL  ") + name + (detail ? "  [" + detail + "]" : ""));
};

// Array order deliberately unsorted, so "first in the list" and "first by name" differ.
const NAMES = ["Fire", "Ice", "Toxic", "Copper", "Amber", "Matrix"];
const idx = n => NAMES.indexOf(n);
// display order: Amber(4) Copper(3) Fire(0) Ice(1) Matrix(5) Toxic(2)

// --- 1. display order is by name, not array order -----------------------------
P.setUp(NAMES, null, []);
ok(P.palByName().map(P.nameAt).join(",") === "Amber,Copper,Fire,Ice,Matrix,Toxic",
   "palByName lists by name, leaving PALETTES untouched", P.palByName().map(P.nameAt).join(","));
ok(P.names().join(",") === NAMES.join(","), "...and the array itself never moves");

// --- 2. the neighbour you can see ---------------------------------------------
// Everything in use: deleting Fire lands on Ice, the NEXT one in the strip — not Amber
// (first by name) and not whatever sits at index 0.
P.setUp(NAMES, null, []);
ok(P.nameAt(P.palFallbackFor(idx("Fire"))) === "Ice",
   "all in use: falls to the next palette in display order", P.nameAt(P.palFallbackFor(idx("Fire"))));
ok(P.nameAt(P.palFallbackFor(idx("Toxic"))) === "Amber",
   "...and the last one by name wraps round to the first", P.nameAt(P.palFallbackFor(idx("Toxic"))));

// --- 3. it prefers a palette that is IN USE ------------------------------------
// Only Matrix and the doomed Copper are ticked: the landing has to be Matrix even though
// Amber sorts first and Fire sits at index 0.
P.setUp(NAMES, [idx("Copper"), idx("Matrix")], []);
ok(P.nameAt(P.palFallbackFor(idx("Copper"))) === "Matrix",
   "prefers an in-use palette over a nearer unticked one", P.nameAt(P.palFallbackFor(idx("Copper"))));

// --- 4. THE REPORTED BUG -------------------------------------------------------
// Fire is deleted (tombstoned) and the in-use set has been narrowed to the palette being
// deleted, so nothing else is in use. The old code fell through to PALETTES[0] = Fire.
P.setUp(NAMES, [idx("Toxic")], [idx("Fire")]);
const landed = P.palFallbackFor(idx("Toxic"));
ok(P.nameAt(landed) !== "Fire", "a DELETED palette is never the fallback", P.nameAt(landed));
ok(!P.palInUse(idx("Fire")) && P.palByName().includes(idx("Fire")),
   "...even though it is still in PALETTES (scenes that store it keep rendering)");
// Toxic sorts last, so the ring wraps to the top of the display order: Amber, and NOT Fire
// (deleted) even though Fire is both index 0 and earlier in the array.
ok(P.nameAt(landed) === "Amber", "nothing in use ⇒ the next ALIVE palette in display order, wrapping",
   P.nameAt(landed));

// Same, with a whole run of deleted palettes sitting where the ring lands first.
// Ring after Matrix: Toxic, Amber, Copper, Fire, Ice — Toxic is the first alive.
P.setUp(NAMES, [idx("Matrix")], [idx("Fire"), idx("Amber"), idx("Copper")]);
ok(P.nameAt(P.palFallbackFor(idx("Matrix"))) === "Toxic",
   "skips a whole run of deleted palettes", P.nameAt(P.palFallbackFor(idx("Matrix"))));

// --- 5. the tombstone is applied BEFORE the fallback is computed ----------------
// deleteAnyPalette adds to palGone first, so the palette being deleted cannot come back.
P.setUp(NAMES, null, [idx("Ice")]);
ok(P.palFallbackFor(idx("Ice")) !== idx("Ice"), "never returns the palette being deleted");

// --- 6. the in-use set is never left empty --------------------------------------
P.setUp(NAMES, [idx("Toxic")], [idx("Toxic")]);      // the only ticked one was just deleted
const land6 = P.palFallbackFor(idx("Toxic"));
P.palKeepInUse(land6);
ok(P.use().includes(land6), "palKeepInUse ticks the landing palette when the set would be empty",
   JSON.stringify(P.use()));
ok(P.palInUse(land6), "...so something is in use again (the strip and the cycle both need one)");
// A landing palette that is already ticked is left alone, and `null` (= all) stays null.
P.setUp(NAMES, null, []);
P.palKeepInUse(idx("Ice"));
ok(P.use() === null, "an all-in-use set stays 'all' rather than materialising");

// --- 7. a custom delete shifts the landing index ---------------------------------
// palRemapOne writes `back` verbatim, so a survivor ABOVE the deleted index must be shifted
// down by one first — otherwise every reference lands on the wrong ramp.
P.setUp(NAMES, null, []);
const gone = 2, back = 5;                 // survivor sits after the deleted entry
const backLive = back > gone ? back - 1 : back;
ok(P.palRemapOne(gone, gone, backLive) === backLive, "a reference to the deleted palette takes the fallback");
ok(P.palRemapOne(5, gone, backLive) === 4, "a reference above the deleted index shifts down");
ok(P.palRemapOne(1, gone, backLive) === 1, "a reference below it is untouched");
ok(backLive === 4, "the fallback itself is shifted before it is stored", String(backLive));
ok(P.palRemapOne("5", gone, backLive) === "4", "string flavour in, string flavour out");

// --- 8. stable palette ids at the serialize edge ---------------------------------
// Palette refs travel as string IDS now (converted beside effect ids in serializeBlob /
// deserializeBlob), with raw numerics decoding forever as legacy positions. Slices the
// REAL id table, hash, converters and both codec halves; stubs only what they read.
// Markers: `// ---- stable palette ids` … `function customPalEntry(`,
// `function palStopsOk(` … `// The stops to seed the editor`,
// `const LEGACY_EFFECT_IDS` … `// Per-effect slider presets,`.
{
  const stub = `
    const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
    const PAL_BUILTIN = 19, PAL_MAX_CUSTOM = 24, PAL_MAX_STOPS = 16, PAL_MIN_STOPS = 2;
    const PALETTES = Array.from({ length: 19 }, () => ({}));
    const EFFECTS = [{ id: "sirpinfyer" }, { id: "tetrafyer" }, { id: "animejulia" }, { id: "plasma" }];
  `;
  const C = new Function(stub
    + cut("  // ---- stable palette ids", "  function customPalEntry(")
    + cut("  function palStopsOk(", "  // The stops to seed the editor")
    + cut("  const LEGACY_EFFECT_IDS", "  // Per-effect slider presets,")
    + "\nreturn { PAL_IDS, PALETTES, palHashId, palIdOut, palIdxIn, customPalettesOk,"
    + "  serializeBlob, deserializeBlob };")();

  // The frozen table — hard-coded here like singleprobe's SINGLE_KEYS, so an edit to the
  // shipped list (reorder, rename-as-id-change) goes red instead of quietly re-mapping
  // every stored blob.
  const WANT = ["fire", "ice", "toxic", "copper", "purple", "rainbow", "grayscale",
    "electric", "amber", "matrix", "sunset", "c64", "cga", "blood", "chrome",
    "tricolor", "ember", "verdant", "sunburst"];
  ok(JSON.stringify(C.PAL_IDS) === JSON.stringify(WANT),
     "PAL_IDS is exactly the shipped 19, in catalog order", C.PAL_IDS.join(","));

  // Round trip, built-in refs everywhere a palette can ride.
  const blob = {
    effect: 3,
    extras: { 3: { palette: "7", morph: true } },
    layers: [{ effect: "plasma", palette: "1" }, { effect: "plasma" }],
    palUse: [0, 7], palGone: [2],
    presets: [{ name: "T", effect: 3, extra: { palette: "9" }, layers: [{ palette: "4" }] }],
  };
  const enc = C.serializeBlob(blob);
  ok(enc.extras.plasma.palette === "electric", "extras.palette encodes to an id", enc.extras.plasma.palette);
  ok(enc.layers[0].palette === "ice" && enc.layers[1].palette === undefined,
     "layer palettes encode; an absent one stays absent");
  ok(JSON.stringify(enc.palUse) === '["fire","electric"]' && JSON.stringify(enc.palGone) === '["toxic"]',
     "palUse/palGone encode to id lists");
  ok(enc.presets[0].extra.palette === "matrix" && enc.presets[0].layers[0].palette === "purple",
     "a preset's extra and layers encode too");
  ok(blob.extras[3].palette === "7" && blob.presets[0].extra.palette === "9",
     "encoding copies — the runtime objects handed in are never mutated");
  const dec = C.deserializeBlob(enc);
  ok(dec.extras[3].palette === "7" && dec.layers[0].palette === "1"
     && JSON.stringify(dec.palUse) === "[0,7]" && JSON.stringify(dec.palGone) === "[2]"
     && dec.presets[0].extra.palette === "9" && dec.presets[0].layers[0].palette === "4",
     "…and the whole blob decodes back to the original indices");

  // Legacy numerics decode forever; null palUse (= all) passes through untouched.
  const leg = C.deserializeBlob({ effect: "plasma", extras: { plasma: { palette: "7" } }, palUse: null });
  ok(leg.extras[3].palette === "7" && leg.palUse === null,
     "a pre-id blob's numeric refs and null palUse decode unchanged");

  // Customs: ids are content-derived, minted for pre-id blobs, resolved against the blob's
  // OWN list, and an unknown id is dropped — never misfiled onto someone else's ramp.
  const stops = [[0, [0, 0, 0]], [1, [255, 255, 255]]];
  const mint = C.customPalettesOk([{ name: "My", stops }]);
  ok(mint.length === 1 && /^u[0-9a-z]+$/.test(mint[0].id), "a pre-id custom gets a minted id", mint[0].id);
  ok(JSON.stringify(C.customPalettesOk(mint)) === JSON.stringify(mint),
     "customPalettesOk is idempotent (deserializeBlob and applyBlob both run it)");
  const twice = C.customPalettesOk([{ name: "My", stops }, { name: "My", stops }]);
  ok(twice.length === 2 && twice[0].id !== twice[1].id, "identical ramps get distinct ids");
  const cdec = C.deserializeBlob({
    palettes: [{ name: "My", stops }],
    extras: { plasma: { palette: mint[0].id } },
  });
  ok(cdec.extras[3].palette === "19", "a custom id resolves against the blob's own list",
     cdec.extras[3].palette);
  const gone2 = C.deserializeBlob({ extras: { plasma: { palette: "unowhere", morph: true } } });
  ok(gone2.extras[3].palette === undefined && gone2.extras[3].morph === true,
     "an unknown id is dropped (the rest of the extra survives), never misfiled");

  // Encode side for a custom: the live entry's id is what travels.
  C.PALETTES.push({ custom: true, id: mint[0].id });
  ok(C.palIdOut(19) === mint[0].id, "a custom index encodes to its entry's id");
}

console.log("\n" + (fail ? fail + " FAILED, " + pass + " passed" : "all " + pass + " passed"));
process.exit(fail ? 1 : 0);
