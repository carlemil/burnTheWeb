// --- Per-slot render state must move WITH the layer ---------------------------------------
//
// Reported as a second copy of the glass balls "hundreds of frames behind", appearing the
// instant layers were rearranged and fading out a few seconds later.
//
// The cause: retained heat (glTex.heatL / glFbo.heatL / layerCur) and the palette-morph clock
// (layerPal) are indexed by SLOT, while a layer's slot is not fixed -- dragging a row reorders
// `stack` and deleting one shifts everything below it up. Nothing moved that state to match,
// so a layer inherited the PREVIOUS OCCUPANT'S trails. With a short-lived filter that is a
// blink; with Zoom feedback, whose Lifetime runs to 0.995, the inherited picture is hundreds
// of frames old and takes seconds to decay -- exactly what was described.
//
// A screenshot cannot show this: one frame of the wrong trails looks like a frame of trails.
// It is a property of what survives a REORDER, so it gets tested as one.
//
// Slices real source by markers -- keep them:
//   "const SLOT_ARRAYS"  ...  "function layerPalIndex("
"use strict";
const fs = require("fs");
const file = process.argv[2] || "dev-index.html";
const src = fs.readFileSync(file, "utf8");

let fails = 0, passes = 0;
function ok(name, cond, note) {
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

// Stand-ins for the five arrays, each entry tagged with the layer that owned it, so a
// permutation can be checked by identity rather than by hoping the numbers line up.
const glTex = { heatL: ["h0", "h1", "h2", "h3"], palL: ["p0", "p1", "p2", "p3"] };
const glFbo = { heatL: ["f0", "f1", "f2", "f3"] };
let layerCur = [0, 1, 0, 1, 9, 9, 9, 9];      // live 0-3, outgoing 4-7
let layerPal = ["m0", "m1", "m2", "m3"];
const api = new Function("glTex", "glFbo", "layerCur", "layerPal",
  slice("const SLOT_ARRAYS", "function layerPalIndex(")
  + "\nreturn { move: moveSlotState, drop: dropSlotState };")(glTex, glFbo, layerCur, layerPal);

console.log("--- per-slot render state follows its layer (" + file + ")\n");

// ---- a reorder ---------------------------------------------------------------------------
{
  api.move(0, 2);                       // drag layer 1 down to third place
  ok("REORDERING CARRIES THE RETAINED HEAT WITH THE LAYER",
     glTex.heatL.join(",") === "h1,h2,h0,h3", glTex.heatL.join(","));
  ok("...its framebuffers too, or the pair would be split",
     glFbo.heatL.join(",") === "f1,f2,f0,f3", glFbo.heatL.join(","));
  ok("...and which of the pair is live", layerCur.slice(0, 4).join(",") === "1,0,0,1",
     layerCur.slice(0, 4).join(","));
  ok("...and the palette-morph clock", layerPal.join(",") === "m1,m2,m0,m3", layerPal.join(","));
  ok("...and the layer's baked palette", glTex.palL.join(",") === "p1,p2,p0,p3", glTex.palL.join(","));
  // The outgoing half is a detached snapshot of a scene nobody is editing; its slots did not
  // move, and permuting them would corrupt a transition that is mid-blend.
  ok("the OUTGOING half is untouched", layerCur.slice(4).join(",") === "9,9,9,9",
     layerCur.slice(4).join(","));
}
// ---- nothing is lost or duplicated -------------------------------------------------------
{
  const all = glTex.heatL.concat(glFbo.heatL, glTex.palL, layerPal);
  ok("every buffer still exists exactly once", new Set(all).size === all.length,
     all.length + " entries, " + new Set(all).size + " distinct");
}
// ---- a delete ----------------------------------------------------------------------------
{
  const before = glTex.heatL.slice();
  api.drop(1);                          // remove whatever is now in slot 2
  ok("DELETING A LAYER LEAVES EVERY SURVIVOR ITS OWN HEAT",
     glTex.heatL.slice(0, 2).join(",") === before[0] + "," + before[2],
     before.join(",") + " -> " + glTex.heatL.join(","));
  ok("...and the removed layer's buffer is kept, not dropped on the floor",
     glTex.heatL.indexOf(before[1]) === glTex.heatL.length - 1, glTex.heatL.join(","));
  ok("...so the pool still owns all four", new Set(glTex.heatL).size === 4, glTex.heatL.join(","));
}
// ---- the wiring --------------------------------------------------------------------------
{
  const reorder = src.slice(src.indexOf("stack.splice(to, 0, stack.splice(from, 1)[0]);"),
                            src.indexOf("stack.splice(to, 0, stack.splice(from, 1)[0]);") + 500);
  ok("the reorder calls it", /moveSlotState\(from, to\)/.test(reorder));
  const rm = src.slice(src.indexOf("function removeStackItem("),
                       src.indexOf("function removeStackItem(") + 500);
  ok("...and so does the delete", /dropSlotState\(j\)/.test(rm));
}

console.log("\n" + passes + " passed, " + fails + " failed");
process.exit(fails ? 1 : 0);
