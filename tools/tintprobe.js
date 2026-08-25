// --- The per-layer TINT: a colour belongs to its LAYER, not to its slot ----------------
//
// The cue exists so you can tell which boxes belong to which layer. That only works if the
// colour is stable: it must survive a reorder, survive a delete of some other layer, and a
// colour freed by a deleted layer must become available to a new one rather than being
// burned for the session.
//
// None of that is visible to a screenshot -- every individual frame looks correctly
// colour-coded whether or not the colours move around between frames. It is a property of
// the SEQUENCE of edits, which is exactly what a probe is for.
//
// Slices real source by markers -- keep them:
//   "const LYR_TINT = CONFIG.layerTint;"  ...  "const TINT_RGB"
"use strict";
const fs = require("fs");
const file = process.argv[2] || "dev-index.html";
const src = fs.readFileSync(file, "utf8");

let fails = 0, passes = 0;
function ok(name, cond, note) {
  // The swapped-argument trap: ok(cond, name) passes forever, because a non-empty name is a
  // truthy condition. Hard-fail on it rather than trusting the call sites.
  if (typeof name !== "string") { console.log("BAD ASSERTION: name must be a string"); process.exit(1); }
  if (cond) { passes++; console.log("PASS  " + name + (note ? "  [" + note + "]" : "")); }
  else { fails++; console.log("FAIL  " + name + (note ? "  [" + note + "]" : "")); }
}
function slice(from, to) {
  const a = src.indexOf(from);
  if (a < 0) throw new Error("marker missing: " + from);
  const b = src.indexOf(to, a);
  if (b < 0) throw new Error("marker missing: " + to);
  return src.slice(a, b);
}

// CONFIG.layerTint is the real shipped list, read out of the built file so the probe cannot
// disagree with the app about how many colours there are.
const tintList = JSON.parse(src.match(/layerTint:\s*(\[[^\]]*\])/)[1].replace(/'/g, '"'));
const CONFIG = { layerTint: tintList };
// Handed back out of a Function rather than eval'd into scope: this file is strict, and a
// strict eval keeps its declarations to itself, so the names would silently not exist.
// Synthetic palettes, so the SCORING is what gets tested rather than whichever ramp the app
// happens to ship. Each fn takes 0..255 and returns [r,g,b], like the real ones.
const PALETTES = [
  { fn: v => [v, 0, 0] },                                   // 0: pure red ramp
  { fn: v => [0, v, 0] },                                   // 1: pure green ramp
  { fn: v => [v, v, v] },                                   // 2: greyscale -- no colour at all
  { fn: v => [255, 255, 255] },                             // 3: pure white -- nothing to take
  { fn: v => (v < 128 ? [0, 0, 0] : [255, 240, 235]) },     // 4: near-black to near-white
];
const body = slice("const LYR_TINT = CONFIG.layerTint;", "const TINT_RGB");
const api2 = new Function("CONFIG", "PALETTES", "layerPalIndex", "stack",
  body + "\nreturn { tintOk, layerTintIdx, layerTint, palTintColor, palTintFlush," +
  "  freeTintIdx, resolveTints, palTintList, relLum, TINT_MIN_LUM };")(CONFIG, PALETTES, L => (L && L.pal) | 0, []);
const { tintOk, layerTintIdx, layerTint, palTintColor, palTintList, freeTintIdx, resolveTints, relLum, TINT_MIN_LUM } = api2;

console.log("--- per-layer tint (" + file + "), " + tintList.length + " colours\n");

const mk = t => ({ tint: t });
const colours = items => items.map((L, i) => layerTintIdx(L, i));

// ---- the guarantee for scenes saved before tints were concrete -------------------------
{
  const nulls = [mk(null), mk(null), mk(null), mk(null)];
  const before = colours(nulls);      // what such a scene renders as TODAY, via the slot
  resolveTints(nulls);
  ok("an untinted scene keeps exactly the colours it already rendered",
     JSON.stringify(colours(nulls)) === JSON.stringify(before),
     before.join(",") + " -> " + colours(nulls).join(","));
  ok("...and every layer is concrete afterwards",
     nulls.every(L => typeof L.tint === "number"),
     JSON.stringify(nulls.map(L => L.tint)));
}
{
  // A stored tint is never overwritten, and a null does not collide with one.
  const mixed = [mk(2), mk(null), mk(null)];
  resolveTints(mixed);
  ok("a stored tint survives resolution untouched", mixed[0].tint === 2);
  const set = new Set(mixed.map(L => L.tint));
  ok("a null never lands on a colour already spoken for", set.size === 3,
     JSON.stringify(mixed.map(L => L.tint)));
}

// ---- the three properties asked for ----------------------------------------------------
{
  const items = [mk(null), mk(null), mk(null), mk(null)];
  resolveTints(items);
  // The RESOLVED colour each layer shows at rest, not the raw field: if the fix is absent
  // the field is null, and comparing against null would fail every permutation including
  // the identity one -- red for the right reason but with a diagnostic that blames the
  // wrong swap. What is being claimed is about the colour on screen.
  const idOf = new Map(items.map((L, i) => [L, layerTintIdx(L, i)]));

  // 1. REORDER. Move the last layer to the front -- the drag the layer list supports.
  const moved = [items[3], items[0], items[1], items[2]];
  ok("reordering changes nobody's colour",
     moved.every((L, i) => layerTintIdx(L, i) === idOf.get(L)),
     moved.map((L, i) => layerTintIdx(L, i)).join(","));

  // Every pairwise swap, not just the one above -- a slot-derived colour survives some
  // permutations by luck (swapping two layers whose slots share a colour, say).
  let worst = null;
  for (let a = 0; a < items.length && !worst; a++)
    for (let b = 0; b < items.length; b++) {
      const p = items.slice(); p[a] = items[b]; p[b] = items[a];
      const bad = p.findIndex((L, i) => layerTintIdx(L, i) !== idOf.get(L));
      if (bad >= 0) { worst = "swap " + a + "/" + b + " recoloured slot " + bad; break; }
    }
  ok("...for every pairwise swap, not just one", worst === null, worst || "all 16 stable");

  // 2. DELETE. Removing any one layer must leave the others alone.
  let broke = null;
  for (let d = 0; d < items.length && !broke; d++) {
    const rest = items.filter((_, i) => i !== d);
    const bad = rest.findIndex((L, i) => layerTintIdx(L, i) !== idOf.get(L));
    if (bad >= 0) broke = "deleting " + d + " recoloured the layer now at " + bad;
  }
  ok("deleting any layer changes nobody else's colour", broke === null, broke || "all 4 stable");
}

// ---- 3. a freed colour comes back into circulation -------------------------------------
{
  // Mirrors what addStackItem does: ask the CURRENT stack what is taken, take a free one.
  const add = live => {
    const L = mk(freeTintIdx(new Set(live.map((o, i) => layerTintIdx(o, i))), live.length));
    live.push(L); return L;
  };
  const live = [];
  const first = [add(live), add(live), add(live), add(live)].map(L => L.tint);
  ok("four fresh layers take four different colours", new Set(first).size === 4, first.join(","));

  const freed = live[1].tint;                 // delete the second layer
  live.splice(1, 1);
  const fresh = add(live);
  ok("a new layer reuses a colour the deleted layer gave up",
     fresh.tint === freed, "freed " + freed + ", new layer took " + fresh.tint);
  ok("...without colliding with a surviving layer",
     new Set(live.map(L => L.tint)).size === live.length,
     live.map(L => L.tint).join(","));

  // The colour must not be burned for the session: delete and re-add repeatedly and the
  // set of colours in use has to stay the same size.
  for (let i = 0; i < 12; i++) { live.splice(i % live.length, 1); add(live); }
  ok("churning layers never exhausts the palette",
     new Set(live.map(L => L.tint)).size === live.length && live.length === 4,
     live.length + " layers, " + new Set(live.map(L => L.tint)).size + " distinct colours");
}

// ---- the trust boundary still holds ----------------------------------------------------
{
  const bad = [null, undefined, "#ff0000", "2", 1.5, -1, tintList.length, NaN, {}, []];
  ok("tintOk still rejects everything that is not an in-range index",
     bad.every(v => tintOk(v) === null),
     bad.length + " hostile values rejected");
  ok("...and accepts every real one",
     tintList.every((_, i) => tintOk(i) === i));
}

// ---- THE TINT COMES FROM THE LAYER'S OWN PALETTE ----------------------------------------
// A fixed set of four colours told you which boxes belonged together but nothing about which
// LAYER -- the blue box could be the ocean or the plasma and you still had to read the label.
// Taking the strongest colour out of the layer's palette makes the cue self-describing.
function hexRGB(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}
function sat(h) {
  const c = hexRGB(h), mx = Math.max.apply(null, c), mn = Math.min.apply(null, c);
  return mx ? (mx - mn) / mx : 0;
}
{
  const red = palTintColor(0), green = palTintColor(1);
  ok("a red palette gives a red tint", hexRGB(red)[0] > 120 && hexRGB(red)[1] < 60, red);
  ok("a green palette gives a green tint", hexRGB(green)[1] > 120 && hexRGB(green)[0] < 60, green);
  ok("...so two layers on different palettes are marked differently", red !== green, red + " vs " + green);
  ok("the colour it picks is STRONG", sat(red) > 0.8 && sat(green) > 0.8,
     "saturation " + sat(red).toFixed(2) + " / " + sat(green).toFixed(2));
  // The ends of most ramps are near-black and near-white, and both are useless as a marker.
  const ends = palTintColor(4), c = hexRGB(ends);
  const lum = (Math.max.apply(null, c) + Math.min.apply(null, c)) / 510;
  ok("...and not the near-black or near-white end of a ramp", lum > 0.2 && lum < 0.95,
     ends + " lum " + lum.toFixed(2));
}
{
  // A ramp with no colour in it has nothing to offer, so it must fall back rather than
  // marking the layer in grey -- which would read as "no layer".
  const grey = palTintColor(2), white = palTintColor(3);
  ok("a colourless palette falls back to the fixed set rather than a grey marker",
     tintList.indexOf(grey) >= 0 && tintList.indexOf(white) >= 0, grey + " / " + white);
}
{
  // The reorder/delete guarantee, now held by the palette rather than by a resolved index.
  const items = [{ pal: 0 }, { pal: 1 }, { pal: 4 }];
  const before = items.map((L, i) => layerTint(L, i));
  ok("every layer is marked in its own palette's colour", new Set(before).size === 3, before.join(" "));
  const moved = [items[2], items[0], items[1]];
  ok("REORDERING CHANGES NOBODY'S COLOUR",
     moved.every((L, i) => layerTint(L, i) === before[items.indexOf(L)]),
     moved.map((L, i) => layerTint(L, i)).join(" "));
  const rest = [items[0], items[2]];
  ok("...and neither does deleting one",
     rest.every((L, i) => layerTint(L, i) === before[items.indexOf(L)]));
  // An explicit pick still wins -- that is what the swatch sets.
  const picked = { pal: 0, tint: 2 };
  ok("an explicit pick still overrides the palette", layerTint(picked, 0) === tintList[2],
     layerTint(picked, 0));
  picked.tint = null;
  ok("...and clearing it hands the layer back to its palette",
     layerTint(picked, 0) === palTintColor(0), layerTint(picked, 0));
}
{
  // The security property tintOk exists for: a colour must never come OUT of a scene, only
  // out of a palette index that has already been validated.
  ok("a hostile stored tint is still refused", tintOk("#ff0000") === null && tintOk("red") === null);
  const hostile = { pal: 0, tint: "#ff0000" };
  ok("...and such a layer falls through to its palette rather than using it",
     layerTint(hostile, 0) === palTintColor(0), layerTint(hostile, 0));
}

{
  // TWO LAYERS ON THE SAME PALETTE still have to be told apart -- one colour marking both
  // says nothing about which is which, which is the whole point of the cue.
  const list = palTintList(0);
  ok("a palette offers several distinct strong colours", list.length >= 2, list.join(" "));
  const uniq = new Set(list);
  ok("...and they really are distinct", uniq.size === list.length, list.length + " colours");
  ok("...so layers sharing a palette get different marks",
     palTintColor(0, 0) !== palTintColor(0, 1), palTintColor(0, 0) + " vs " + palTintColor(0, 1));
  ok("...and it wraps rather than running off the end",
     !!palTintColor(0, 99), palTintColor(0, 99));
  // WHICH of them a layer gets is its SALT, not its position -- position shifts when an
  // earlier layer is deleted, which recolours every survivor and is the exact bug the tint
  // was pinned down to avoid. The salt is kept through a reorder and a delete.
  const a = { pal: 0, salt: 0 }, b = { pal: 0, salt: 1 }, c = { pal: 0, salt: 2 };
  const wasB = layerTint(b, 1), wasC = layerTint(c, 2);
  ok("three layers on ONE palette are still told apart",
     new Set([layerTint(a, 0), wasB, wasC]).size === 3, [layerTint(a, 0), wasB, wasC].join(" "));
  ok("...and deleting the first does not recolour the others",
     layerTint(b, 0) === wasB && layerTint(c, 1) === wasC, wasB + " / " + wasC);
}

{
  // THE TINT IS TEXT. A layer box's title is rendered IN this colour on a near-black panel, so
  // every colour the picker can hand out has to be readable at 9px -- a dark one is not a
  // marker, it is a smudge. Judged on real relative luminance with the sRGB curve decoded: the
  // cheap (max+min)/2 lightness used to RANK candidates calls pure blue and pure yellow
  // equally bright, when one is 0.07 and the other 0.93.
  const dark = [];
  for (let i = 0; i < PALETTES.length; i++)
    for (const h of palTintList(i)) {
      const c = hexRGB(h);
      if (relLum(c) < TINT_MIN_LUM - 1e-9) dark.push(i + ":" + h + " lum " + relLum(c).toFixed(3));
    }
  ok("EVERY COLOUR THE PICKER CAN HAND OUT IS READABLE", dark.length === 0,
     dark.join(" | ") || "floor " + TINT_MIN_LUM + ", all clear");
  // Pure blue is the case the cheap metric gets wrong: fully saturated and almost invisible.
  const blue = new Function("return { fn: v => [0, 0, v] };")();
  PALETTES.push(blue);
  const bl = palTintList(PALETTES.length - 1);
  ok("...including a pure blue ramp, which is the hard one",
     bl.every(h => relLum(hexRGB(h)) >= TINT_MIN_LUM - 1e-9),
     bl.join(" "));
  ok("...and it is still recognisably BLUE after being lifted",
     hexRGB(bl[0])[2] > hexRGB(bl[0])[0] + 40, bl[0]);
  PALETTES.pop();
  ok("no variant washes all the way to white",
     palTintList(0).every(h => h.toLowerCase() !== "#ffffff"), palTintList(0).join(" "));
}

console.log("\n" + passes + " passed, " + fails + " failed");
process.exit(fails ? 1 : 0);
