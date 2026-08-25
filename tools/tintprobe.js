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
const body = slice("const LYR_TINT = CONFIG.layerTint;", "const TINT_RGB");
const { tintOk, layerTintIdx, freeTintIdx, resolveTints } = new Function("CONFIG",
  body + "\nreturn { tintOk, layerTintIdx, freeTintIdx, resolveTints };")(CONFIG);

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

console.log("\n" + passes + " passed, " + fails + " failed");
process.exit(fails ? 1 : 0);
