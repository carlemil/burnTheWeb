#!/usr/bin/env node
// Trees -- the point-budget and determinism probe.
//
//   node tools/treeprobe.js dev-index.html
//
// Slices the REAL stamper out of the built file, hands it a fake plot() and runs it. What
// this catches that a screenshot cannot:
//   * the exponential blow-up -- Splits^Depth reaches four million segments at the slider
//     extremes, which is not a wrong picture, it is a locked tab. TR_SEG_MAX clamps the
//     depth, and a still frame at default settings never goes near it;
//   * points off the grid -- plot() silently drops anything outside the heat buffer, so a
//     tree drawn half out of the safe box just looks like a smaller tree;
//   * a dead wind -- if the sway ever stopped accumulating down the branches, the canopy
//     would still move (rigidly), and one frame of a rigid tree and one of a bending tree
//     are indistinguishable;
//   * Math.random creeping in -- the point sequence must be identical frame to frame, or
//     the whole canopy shimmers.
// Markers: `let trCount` ... the end of the file -- keep them.
const fs = require("fs");

const file = process.argv[2] || "dev-index.html";
const src = fs.readFileSync(file, "utf8");

const from = src.indexOf("let trCount");
if (from < 0) throw new Error("marker not found: let trCount");
const to = src.indexOf("function treeStamp(", from);
if (to < 0) throw new Error("marker not found: function treeStamp(");
const end = src.indexOf("\n  }\n", src.indexOf("const swap = cur;", to));
if (end < 0) throw new Error("could not find the end of treeStamp");
const body = src.slice(from, end + 5);

let pass = 0, fail = 0;
const ok = (cond, name, detail) => {
  (cond ? pass++ : fail++);
  console.log((cond ? "PASS  " : "FAIL  ") + name + (detail ? "  [" + detail + "]" : ""));
};

// Fake host: a plot() that records, and the two globals the stamper reads.
function build() {
  const rec = { pts: [], calls: 0 };
  const api = [
    "  const SET = { count: v => trCount = v, depth: v => trDepth = v, split: v => trSplit = v,",
    "                angle: v => trAngle = v, shrink: v => trShrink = v, sway: v => trSway = v,",
    "                speed: v => trSpeed = v };",
    "  return { treeStamp, trMaxDepth, trHash, TR_SEG_MAX,",
    "           set: o => { for (const k in o) SET[k](o[k]); },",
    "           phase: () => trPhase, reset: () => { trPhase = 0; } };",
  ].join("\n");
  const plot = (x, y, v) => { rec.calls++; rec.pts.push(x, y, v); };
  const P = new Function("cfg", "plot", "POINT_HEAT", body + api)({ burn: 120 }, plot, 209);
  return { P, rec };
}

// --- 1. the segment budget --------------------------------------------------------
{
  const { P } = build();
  const segs = (split, depth) => { let t = 0, lev = 1; for (let d = 0; d < depth; d++) { t += lev; lev *= split; } return t; };
  let worst = 0, worstAt = "";
  for (let split = 2; split <= 4; split++) for (let want = 1; want <= 11; want++) {
    const d = P.trMaxDepth(split, want);
    const n = segs(split, d);
    if (n > worst) { worst = n; worstAt = "split " + split + " asked " + want + " got depth " + d; }
    if (d > want) { ok(false, "trMaxDepth never DEEPENS a tree", "split " + split + " want " + want + " got " + d); }
  }
  ok(worst <= P.TR_SEG_MAX, "no slider pair can exceed the segment budget",
     worst + " segments max, cap " + P.TR_SEG_MAX + " (" + worstAt + ")");
  // ...and the cap is actually reachable, or it would be a cap on nothing.
  ok(P.trMaxDepth(4, 11) < 11, "the cap really does clamp the extreme settings",
     "split 4 depth 11 -> " + P.trMaxDepth(4, 11));
  // The shipped default must NOT be clamped -- the default has to be the tree it says.
  ok(P.trMaxDepth(2, 8) === 8, "the shipped default (2 splits, depth 8) is not clamped");
}

// --- 2. every point lands inside the safe box -------------------------------------
// plot() drops out-of-grid points silently, so a tree growing through the ceiling looks
// like a smaller tree rather than like a bug.
{
  const BOX = [1, 319, 1, 179];
  let outside = 0, total = 0, worstY = Infinity;
  for (const split of [2, 3, 4]) for (const depth of [3, 8, 11]) for (const sway of [0, 1.5]) {
    const { P, rec } = build();
    P.set({ count: 5, depth: depth, split: split, angle: 65, shrink: 0.85, sway: sway, speed: 1 });
    for (let f = 0; f < 30; f++) { rec.pts.length = 0; P.treeStamp(BOX[0], BOX[1], BOX[2], BOX[3], 4000); }
    for (let i = 0; i < rec.pts.length; i += 3) {
      const x = rec.pts[i], y = rec.pts[i + 1];
      total++;
      worstY = Math.min(worstY, y);
      if (x < BOX[0] - 1e-9 || x > BOX[1] + 1e-9 || y < BOX[2] - 1e-9 || y > BOX[3] + 1e-9) outside++;
    }
  }
  // A tree is allowed to grow past the top and the sides -- that is a tree filling the
  // frame, and plot() crops it. What must NOT happen is the whole canopy leaving: assert
  // the great majority lands, and that the tips reach UP (row 0 is the screen top).
  ok(total > 0, "the stamper draws something at every setting", total + " points");
  // The trunk length is solved so the straight-chain height is 0.9 of the box at every
  // Taper (see the note in treeStamp), so what escapes now is only the sideways splay of
  // five wide-angle trees -- not the tree growing through the ceiling.
  ok(outside / total < 0.20, "most of the canopy lands inside the safe box",
     (100 * outside / total).toFixed(1) + "% outside");
  ok(worstY > -0.1 * BOX[3], "and the tree is SCALED to the box rather than growing through the top",
     "highest point y=" + worstY.toFixed(1) + " in a " + BOX[2] + ".." + BOX[3] + " box");
  ok(worstY < BOX[3] * 0.5, "while still filling it",
     "highest point y=" + worstY.toFixed(1));
}

// --- 3. the wind ACCUMULATES down the branches ------------------------------------
// A rigid tree and a bending tree look the same in one frame. The property that separates
// them: the tips must move much further over a gust than the trunk does.
{
  const BOX = [1, 319, 1, 179];
  const spread = swayAmt => {
    const { P, rec } = build();
    P.set({ count: 1, depth: 7, split: 2, angle: 28, shrink: 0.72, sway: swayAmt, speed: 1 });
    // Sample the same tree across a full wind cycle and measure how far each point moved.
    const frames = [];
    for (let f = 0; f < 24; f++) { rec.pts.length = 0; P.treeStamp(BOX[0], BOX[1], BOX[2], BOX[3], 6000); frames.push(rec.pts.slice()); }
    // Compare like with like: the point lists are the same length every frame (same tree,
    // same budget), so index i is the same place on the same branch.
    const len = Math.min.apply(null, frames.map(f => f.length));
    let nearRoot = 0, nearTip = 0;
    for (let i = 0; i < len; i += 3) {
      let lo = Infinity, hi = -Infinity;
      for (const f of frames) { lo = Math.min(lo, f[i]); hi = Math.max(hi, f[i]); }
      // The trunk is drawn first, the twigs last -- so the first tenth is root and the
      // last tenth is canopy.
      if (i < len * 0.1) nearRoot = Math.max(nearRoot, hi - lo);
      if (i > len * 0.9) nearTip = Math.max(nearTip, hi - lo);
    }
    return { root: nearRoot, tip: nearTip };
  };
  const windy = spread(1.0), still = spread(0);
  ok(still.tip < 1e-9 && still.root < 1e-9, "Sway 0 freezes the tree completely",
     "tip travel " + still.tip.toExponential(1));
  ok(windy.tip > 1, "the canopy moves in a wind", "tip travel " + windy.tip.toFixed(1) + "px");
  ok(windy.tip > windy.root * 4, "and the TIPS move far more than the trunk -- the bend accumulates",
     "root " + windy.root.toFixed(2) + "px vs tip " + windy.tip.toFixed(1) + "px");
}

// --- 4. determinism ---------------------------------------------------------------
{
  const BOX = [1, 319, 1, 179];
  const run = () => {
    const { P, rec } = build();
    P.set({ count: 3, depth: 8, split: 2, angle: 28, shrink: 0.72, sway: 0.35, speed: 1 });
    P.treeStamp(BOX[0], BOX[1], BOX[2], BOX[3], 9000);
    return rec.pts;
  };
  const a = run(), b = run();
  ok(a.length === b.length && a.every((v, i) => v === b[i]),
     "the same tick draws the identical point sequence", a.length / 3 + " points");
  // Strip comments before grepping -- this source discusses Math.random in prose.
  const bare = body.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  ok(bare.indexOf("Math.random") < 0, "no Math.random anywhere in the stamper");
  ok(bare.indexOf("rnd(") < 0, "and it does not draw from the shared chaos PRNG either");
  ok(src.indexOf('["trPhase", () => trPhase, v => trPhase = v]') >= 0,
     "trPhase rides PHASE_VARS, so two Trees layers gust separately");
}

// --- 5. the point budget is honoured ----------------------------------------------
// Points is a user-facing count; a stamper that ignores it makes the slider a lie.
{
  const BOX = [1, 319, 1, 179];
  const drawn = want => {
    const { P, rec } = build();
    P.set({ count: 3, depth: 8, split: 2, angle: 28, shrink: 0.72, sway: 0.35, speed: 1 });
    P.treeStamp(BOX[0], BOX[1], BOX[2], BOX[3], want);
    return rec.calls;
  };
  const lo = drawn(4000), hi = drawn(20000);
  ok(hi > lo * 2, "more Points really does draw more points", lo + " -> " + hi);
  ok(hi < 20000 * 3, "and it does not blow through the budget", hi + " for a 20000 budget");
}

console.log("");
console.log(fail ? (fail + " FAILED, " + pass + " passed") : ("all " + pass + " passed"));
process.exit(fail ? 1 : 0);
