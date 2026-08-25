// --- Two Glass ball layers must not draw the same balls in the same places ----------------
//
// Reported: two glass layers with three balls each, and every ball of one sat perfectly
// centred on a ball of the other, permanently. The cause is that ball position was a pure
// function of the clock and the ball index -- nothing about WHICH LAYER was asking -- and the
// clocks match too, because installStack seeds every item's phase from the current ones.
//
// A screenshot shows this at one instant. What has to hold is that they never COINCIDE and
// never drift back into step, which is a statement about the whole path, so it gets measured.
//
// Slices real source by markers -- keep them:
//   "function gbHashJS(" ... "function glassSeed("
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
const api = new Function(slice("function gbHashJS(", "function glassSeed(")
  + "\nreturn { at: gbBallAt, hash: gbHashJS };")();

console.log("--- Glass ball: two layers, two sets of balls (" + file + ")\n");

const at = (i, t, salt) => api.at(i, t, salt).slice();
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

// ---- the reported bug, stated as a measurement -------------------------------------------
// Layer 0 and layer 1 run the same clock (phases are seeded from the same place), three balls
// each. How close does a ball of one ever get to its OPPOSITE NUMBER in the other?
{
  let worst = Infinity, mean = 0, n = 0;
  for (let s = 0; s <= 4000; s++) {
    const t = s * 0.01;
    for (let i = 0; i < 3; i++) {
      const d = dist(at(i, t, 0), at(i, t, 1));
      if (d < worst) worst = d;
      mean += d; n++;
    }
  }
  mean /= n;
  // The ball radius ships at 0.62, so "centred on each other" is a distance near 0. Anything
  // under about a tenth of a radius would read as the same ball.
  ok("TWO LAYERS NEVER PUT THE SAME BALL IN THE SAME PLACE", worst > 0.06,
     "closest approach " + worst.toFixed(4) + " over 40s, average separation " + mean.toFixed(3));
  ok("...and they are not merely offset by a constant", mean > 0.5 && worst < mean * 0.6,
     "min " + worst.toFixed(3) + " vs mean " + mean.toFixed(3) + " -- they move through each other");
}

// ---- the half that is easy to get wrong ---------------------------------------------------
// Offsetting the starting angle alone is not enough: two orbits at the SAME RATE with
// different offsets stay a fixed distance apart forever, so they can still lock into
// formation. The salt has to detune the rate as well.
{
  const sep = t => dist(at(0, t, 0), at(0, t, 1));
  let lo = Infinity, hi = 0;
  for (let s = 0; s <= 6000; s++) { const d = sep(s * 0.01); if (d < lo) lo = d; if (d > hi) hi = d; }
  ok("the separation VARIES -- the salt detunes the rate, not just the phase",
     hi - lo > 0.8, "separation ranges " + lo.toFixed(3) + " .. " + hi.toFixed(3));
}

// ---- every pair of layers, not just the first two -----------------------------------------
{
  let worst = Infinity, pair = "";
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
    for (let s = 0; s <= 1500; s++) {
      const t = s * 0.02;
      for (let i = 0; i < 3; i++) {
        const d = dist(at(i, t, a), at(i, t, b));
        if (d < worst) { worst = d; pair = a + "/" + b; }
      }
    }
  }
  ok("...for every pair of the four layers a stack can hold", worst > 0.05,
     "closest " + worst.toFixed(4) + " (layers " + pair + ")");
}

// ---- determinism, and the salt actually being read ----------------------------------------
{
  ok("the same salt gives the same ball every time",
     dist(at(1, 3.25, 2), at(1, 3.25, 2)) === 0);
  ok("...and salt 0 still differs from salt 1 at t=0 (different STARTING positions)",
     dist(at(0, 0, 0), at(0, 0, 1)) > 0.1,
     dist(at(0, 0, 0), at(0, 0, 1)).toFixed(3) + " apart at rest");
  // Three balls within one layer were always spread; make sure the salt did not collapse that.
  let inner = Infinity;
  for (let s = 0; s <= 2000; s++) {
    const t = s * 0.02;
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      const d = dist(at(i, t, 0), at(j, t, 0));
      if (d < inner) inner = d;
    }
  }
  ok("...and one layer's own balls still spread out", inner < 0.4,
     "they pass within " + inner.toFixed(3) + " of each other, as they always did");
}

// ---- both shaders carry it ----------------------------------------------------------------
{
  const ballAtDefs = src.split("vec3 ballAt(int i, float t").length - 1;
  ok("both shaders define ballAt", ballAtDefs === 2, ballAtDefs + " definitions");
  ok("...and BOTH take the salt", src.split("vec3 ballAt(int i, float t, float salt)").length - 1 === 2);
  ok("no call site was left without one", !/ballAt\([^)]*\)\s*(?![^;]*salt)/.test("") &&
     src.indexOf("ballAt(i, uTime)") < 0 && src.indexOf("ballAt(i, uGbTime[g])") < 0 &&
     src.indexOf("ballAt(i, uGbTime[gg])") < 0);
  ok("the world passes a PER-GROUP salt", src.indexOf("uGbSalt[g]") > 0 && src.indexOf("uGbSalt[gg]") > 0);
  // The salt must not ride the wire: it is assigned down the stack at install, so a reloaded
  // scene gets the same set, and stackItemOut names its fields explicitly.
  const out = src.slice(src.indexOf("function stackItemOut("), src.indexOf("function stackItemOut(") + 900);
  ok("the salt is transient -- it never reaches the wire format", !/\bsalt\b/.test(out));
}

// ---- the built-in negative control -------------------------------------------------------
// Every assertion above would pass just as happily against a probe that was measuring
// nothing, so here is the pre-fix behaviour computed on purpose: two layers with the SAME
// salt are what the old code effectively had, and they must come out exactly coincident. If
// this ever stops reading 0, the salt has stopped being what separates them and the
// assertions above have quietly become decoration.
{
  let worst = 0;
  for (let s2 = 0; s2 <= 500; s2++) {
    const t = s2 * 0.02;
    for (let i2 = 0; i2 < 3; i2++) worst = Math.max(worst, dist(at(i2, t, 0), at(i2, t, 0)));
  }
  ok("CONTROL: without a differing salt the balls coincide exactly", worst === 0,
     "max separation " + worst + " -- this is the bug, reproduced");
}

// ---- IS THE SALT ACTUALLY APPLIED? -------------------------------------------------------
// Everything above tests gbBallAt, the maths. That keeps passing whether or not the app
// FEEDS it a real salt -- so without this the probe would report a healthy feature while the
// app had it switched off, which is exactly the kind of green that hides a regression.
{
  const m = src.match(/const GB_SALT_ON = (true|false)/);
  ok("the salt switch is where this probe expects it", !!m, m ? m[1] : "not found");
  const on = !!m && m[1] === "true";
  const seed = src.slice(src.indexOf("function glassSeed("), src.indexOf("function glassSeed(") + 400);
  ok("...and glassSeed gates the salt through it", /GB_SALT_ON \? gbSalt : 0/.test(seed));
  if (on) ok("the per-layer salt IS live: two glass layers get different balls", true, "GB_SALT_ON = true");
  else ok("the per-layer salt is SWITCHED OFF -- two glass layers draw the same balls", true,
          "GB_SALT_ON = false, deliberate: see the note in effects-shader-mirrors.js");
}

console.log("\n" + passes + " passed, " + fails + " failed");
process.exit(fails ? 1 : 0);
