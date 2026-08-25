// --- Slime mould: the culture must not NORMALISE -----------------------------------------
//
// Reported as "it normalizes to a very static animation in just a few seconds", and the
// precise diagnosis matters because the obvious one is wrong. The simulation never freezes:
// measured per cell, the trail map keeps changing as fast at minute one as at second one.
// What it does is reach a HOMOGENEOUS equilibrium -- an evenly spaced mesh of veins covering
// the dish, the same density everywhere, forever. Nothing large-scale ever varies again, and
// that is what reads as static.
//
// So the metric here is deliberately NOT per-cell churn. The first version of this probe
// measured exactly that and happily reported a normalised culture as busy -- the veins flicker
// at the same rate whatever the large-scale picture is doing. What is measured instead is
// DRIFT: the dish is divided into coarse blocks, and the question is how far that map of
// block densities MOVES over time. A fixed large-scale pattern has none however much its
// veins twitch. Scatter has to raise it, and must not do it by dissolving the network.
//
// Slices real source by markers -- keep them:
//   "function shHash21("     ...  "let voCells"
//   "const PHY_MAX = 6000"   ...  "// CURL-NOISE FLOW"
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

const noise = slice("function shHash21(", "let voCells");
const body = slice("const PHY_MAX = 6000", "// CURL-NOISE FLOW");
const api = new Function(
  "cfg, fw, fh, POINT_HEAT, plot, stack, zoom",
  noise + "\n" + body +
  "\nreturn { ensurePhy, physarumStamp, W: PHY_W, H: PHY_H," +
  "  set: o => { if (o.count !== undefined) phCount = o.count;" +
  "              if (o.scatter !== undefined) phScatter = o.scatter;" +
  "              if (o.agents !== undefined) phAgents = o.agents; }," +
  "  scatterDefault: phScatter };"
)({ burn: 60 }, 640, 360, 209, function () {}, [], 1);

console.log("--- slime mould: does the culture stay varied? (" + file + ")\n");
ok("Scatter ships non-zero", api.scatterDefault > 0, "default " + api.scatterDefault);

// COARSE blocks -- 3x2, not a fine grid. Measured across grid sizes, and the choice is the
// whole reason this probe says anything: a fine grid measures WHERE INDIVIDUAL VEINS RAN,
// which varies wildly whether or not the culture is alive (spread came out at 1.18 for a
// completely normalised dish). At 3x2 each block averages a sixth of the dish, so what is
// left is the large-scale density map -- the thing that stops changing.
const BX = 3, BY = 2;
function blockDensity(tr, W, H) {
  const d = new Float64Array(BX * BY), n = new Float64Array(BX * BY);
  for (let y = 0; y < H; y++) {
    const by = Math.min(BY - 1, (y * BY / H) | 0);
    for (let x = 0; x < W; x++) {
      // The trail VALUE, not a lit/unlit count: a threshold turns a vein fading out into a
      // step change and adds noise the block average is here to remove.
      d[by * BX + Math.min(BX - 1, (x * BX / W) | 0)] += tr[y * W + x];
      n[by * BX + Math.min(BX - 1, (x * BX / W) | 0)]++;
    }
  }
  for (let i = 0; i < d.length; i++) d[i] /= n[i] || 1;
  return d;
}
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
function run(scatter, warm, win) {
  const P = {};
  api.set({ count: 2500, scatter: scatter, agents: P });
  api.ensurePhy(P, 2500, 1);
  api.set({ agents: P });
  for (let i = 0; i < warm; i++) api.physarumStamp(0, 640, 0, 360, 0);
  const a = blockDensity(P.tr, api.W, api.H);
  for (let i = 0; i < win; i++) api.physarumStamp(0, 640, 0, 360, 0);
  const b = blockDensity(P.tr, api.W, api.H);
  const m = mean(a);
  // DRIFT: how far the large-scale density map moved, as a fraction of its own mean -- so a
  // culture that merely got dimmer does not read as one that reorganised.
  let dr = 0;
  for (let i = 0; i < a.length; i++) dr += Math.abs(a[i] - b[i]);
  return { drift: m > 0 ? dr / a.length / m : 0, trail: m };
}

const WARM = 1200, WIN = 400;             // far past the "few seconds" it took to normalise
const flat = run(0, WARM, WIN);
const live = run(0.3, WARM, WIN);
const hard = run(0.6, WARM, WIN);

ok("with Scatter 0 the large-scale picture stops changing",
   flat.drift < 0.15, "drift " + flat.drift.toFixed(3));
ok("SCATTER KEEPS IT REARRANGING", live.drift > flat.drift * 3,
   "drift " + live.drift.toFixed(3) + " vs " + flat.drift.toFixed(3) + " flat ("
   + (flat.drift > 0 ? (live.drift / flat.drift).toFixed(1) : "inf") + "x)");
ok("...and more of it upsets more", hard.drift > live.drift,
   "drift " + hard.drift.toFixed(3) + " at 0.6 vs " + live.drift.toFixed(3) + " at 0.3");
// The cheap way to score well above is to wreck the network, so this is the guard that makes
// the others mean anything: it has to still be a slime mould.
ok("...without dissolving the network",
   live.trail > flat.trail * 0.5 && hard.trail > flat.trail * 0.4,
   "trail " + live.trail.toFixed(4) + " / " + hard.trail.toFixed(4) + " vs " + flat.trail.toFixed(4));

// DETERMINISM. Every point effect in this app is reproducible and the time-varying field
// must not be what breaks that.
{
  const a = run(0.3, 200, 60), b = run(0.3, 200, 60);
  ok("the same run reproduces exactly (no Math.random)",
     a.drift === b.drift && a.trail === b.trail,
     a.drift.toFixed(6) + " / " + a.trail.toFixed(6));
  ok("...and the source contains no Math.random at all",
     !body.replace(/\/\/[^\n]*/g, "").includes("Math.random"));
}

// The field is per LAYER, beside the agents: two slime layers sharing one would starve the
// same regions in lock-step and read as a single brighter copy.
{
  const P = {};
  api.set({ count: 400, scatter: 0.3, agents: P });
  api.ensurePhy(P, 400, 1);
  api.set({ agents: P });
  api.physarumStamp(0, 640, 0, 360, 0);
  ok("the disturbance field and its clock live on the layer",
     !!P.fld && P.t === 1, "fld " + (P.fld ? P.fld.length + " cells" : "missing") + ", t=" + P.t);
  api.physarumStamp(0, 640, 0, 360, 0);
  ok("...and the clock advances per step, so the field drifts", P.t === 2, "t=" + P.t);
}
// Scatter 0 must cost nothing at all -- it is the old behaviour, kept reachable.
{
  const P = {};
  api.set({ count: 400, scatter: 0, agents: P });
  api.ensurePhy(P, 400, 1);
  api.set({ agents: P });
  api.physarumStamp(0, 640, 0, 360, 0);
  ok("Scatter 0 builds no field at all", !P.fld, P.fld ? "built anyway" : "none");
}

console.log("\n" + passes + " passed, " + fails + " failed");
process.exit(fails ? 1 : 0);
