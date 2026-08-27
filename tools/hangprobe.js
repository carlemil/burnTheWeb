#!/usr/bin/env node
// PAYLOAD-DRIVEN LOOP BOUNDS: a scene arriving from a share link, the public gallery, a cloud
// profile or a backup is ATTACKER-AUTHORED JSON, and nothing it carries may become an unbounded
// loop counter.
//
//   node tools/hangprobe.js [dev-index.html]
//
// WHY THIS EXISTS. Two routes reached stampTick's `n` with no ceiling between them:
//
//   A. mergeState does no bounds check -- the DOM clamp in loadState is the safety net, and it
//      only ever covers the SELECTED layer. bandOf reads L.state directly for every other one,
//      and paintBlock paints the sliders without writing the clamped number back. So
//      layers[1].state.points = [2e9, 2e9] flowed through stepAnim -> installStackItem ->
//      apply -> cfg.points untouched.
//   B. applyRangesFor accepted ANY finite min/max pair, and applyBlob installs `ranges` BEFORE
//      it validates values -- so its own ok() check then measured the payload against the
//      payload's own bounds and passed. That got layer 0 past the DOM clamp too.
//
// Either way the tab wedged on the first rendered frame, with no error and no recovery short of
// killing it. For the routes that persist before reloading (gallery install, cloud load, #zp=)
// applyRestore had already written localStorage, so it re-hung on every subsequent visit.
//
// The fix is a bound at the ONE choke point every point effect's count passes through, plus a
// sanity envelope on the ranges. This probe pins both, and pins that the envelope still admits
// an ordinary user widening -- clamping back to the shipped bounds would break a real feature
// and change how already-saved scenes render.
"use strict";
const fs = require("fs");
const file = process.argv[2] || "dev-index.html";
const src = fs.readFileSync(file, "utf8");

let fails = 0, passes = 0;
function ok(name, cond, extra) {
  if (typeof name !== "string") { console.log("FAIL  ok() called with its arguments swapped"); fails++; return; }
  console.log((cond ? "PASS  " : "FAIL  ") + name + (extra ? "  [" + extra + "]" : ""));
  cond ? passes++ : fails++;
}
function slice(from, to) {
  const a = src.indexOf(from); if (a < 0) throw new Error("marker missing: " + from);
  const b = src.indexOf(to, a); if (b < 0) throw new Error("marker missing: " + to);
  return src.slice(a, b);
}

console.log("--- payload-driven loop bounds (" + file + ")\n");

// ---- the stamp count is finite whatever cfg.points says ------------------------------------
const capM = src.match(/pointCapHard:\s*(\d+)/);
ok("CONFIG carries an absolute stamp ceiling", !!capM, capM ? capM[1] : "pointCapHard missing");
const CAP = capM ? +capM[1] : 0;

// The real line out of stampTick, run against a hostile cfg.points.
const line = src.match(/const nRaw = Math\.round\(cfg\.points[^;]*;[\s\S]{0,120}?const n = nRaw[^;]*;/);
ok("stampTick clamps its count at that ceiling", !!line,
   line ? line[0].split("\n")[0].trim().slice(0, 60) : "not clamped");
if (line) {
  const nFor = new Function("cfg", "zoomPoints", "POINT_CAP_HARD",
    line[0] + "\nreturn n;");
  const zp = () => 8;                                    // zoomPoints at its own cap
  const cases = [
    ["a hostile 2e9", 2e9],
    ["Infinity", Infinity],
    ["a hostile negative", -2e9],
    ["NaN", NaN],
  ];
  for (const [label, pts] of cases) {
    const n = nFor({ points: pts }, zp, CAP);
    ok("...survives " + label, Number.isFinite(n) && n >= 0 && n <= CAP, "n = " + n);
  }
  // ...and every legitimate setting is untouched. 60000 is the largest `points` max any effect
  // declares; 8 is zoomPointCap. If the ceiling ever cut into this, scenes would render thinner.
  const worst = nFor({ points: 60000 }, zp, CAP);
  ok("the shipped worst case is NOT clamped", worst === 60000 * 8, worst + " vs " + 60000 * 8);
}

// ---- the ranges envelope --------------------------------------------------------------------
const env = slice("const span = Math.max(1e-6, o.max - o.min)", "mn = lim(mn)");
ok("applyRangesFor bounds what it accepts", /o\.min - pad/.test(env) && /o\.max \+ pad/.test(env));

const lim = new Function("o", "x",
  env + "\nreturn lim(x);");
{
  const o = { min: 100, max: 24000 };                    // the shipped `points` control
  ok("...a hostile 2e9 bound is cut down", lim(o, 2e9) <= o.max + (o.max - o.min) * 100,
     String(lim(o, 2e9)));
  ok("...and a hostile -2e9 too", lim(o, -2e9) >= o.min - (o.max - o.min) * 100, String(lim(o, -2e9)));
  // The feature this must NOT break: a user widening Points to 200000 through the range editor.
  ok("an ordinary user widening still passes through untouched", lim(o, 200000) === 200000,
     String(lim(o, 200000)));
  ok("...and so does a shipped bound", lim(o, 24000) === 24000 && lim(o, 100) === 100);
}

// ---- the reason the DOM clamp cannot be relied on --------------------------------------------
// Pinned so nobody "simplifies" the guard away on the grounds that loadState already clamps.
const bandOf = slice("function bandOf(L, id)", "const beatOf =");
ok("bandOf still reads a non-selected layer's state directly (so the DOM clamp misses it)",
   /L\.state\s*&&\s*L\.state\[id\]/.test(bandOf));

console.log("\n" + passes + " passed, " + fails + " failed");
process.exit(fails ? 1 : 0);
