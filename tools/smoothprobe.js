#!/usr/bin/env node
// REVERSED smoothstep: smoothstep(hi, lo, x) is UNDEFINED in GLSL when edge0 >= edge1, and the
// dev GPU returns 0 for it. That is a SILENT failure -- the shader compiles, the geometry is
// right, and the picture is black.
//
//   node tools/smoothprobe.js [dev-index.html]
//
// WHY THIS EXISTS. CLAUDE.md has forbidden this construct since it silently zeroed the whole
// Black hole disk and left only the photon ring. The rule was written down and then broken five
// more times anyway -- Starfield (every star zeroed, the entire effect black), Lens bubble (no
// magnification and no rim glint at all), Halftone (undefined AND inverted, so bright cells drew
// the biggest black dots), the Sun's surface grains, and the Ocean's foam edge at the top of its
// slider. A rule nothing checks is a rule that decays; this is the check.
//
// It only reports edges it can compare STATICALLY, which is deliberate: a false positive here
// would train people to ignore it. Three comparable shapes:
//   1. two numeric literals              smoothstep(0.11, 0.0, d)
//   2. an identifier and a scaled copy   smoothstep(uRad, uRad*0.85, r)
//   3. an identifier and itself plus a   smoothstep(uFoam + 0.22, uFoam, x)
//      positive offset on the LOW side
// Anything it cannot prove is left alone.
"use strict";
const fs = require("fs");
const src = fs.readFileSync(process.argv[2] || "dev-index.html", "utf8");

let fails = 0;
function ok(name, cond, extra) {
  if (typeof name !== "string") { console.log("FAIL  ok() called with its arguments swapped"); fails++; return; }
  console.log((cond ? "PASS  " : "FAIL  ") + name + (extra ? "  [" + extra + "]" : ""));
  if (!cond) fails++;
}

// Strip line comments so a smoothstep quoted in prose is not scanned. Block comments are not
// used inside the shader sources.
const lines = src.split("\n").map(l => l.replace(/\/\/.*$/, ""));

const NUM = /^[-+]?[0-9]*\.?[0-9]+$/;
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Is edge0 provably >= edge1?
function reversed(a, b) {
  a = a.trim(); b = b.trim();
  if (NUM.test(a) && NUM.test(b)) return parseFloat(a) >= parseFloat(b);
  // smoothstep(X, X*k, ...) with 0 <= k <= 1  =>  edge0 >= edge1
  if (IDENT.test(a)) {
    const scaled = b.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\*\s*([-+]?[0-9]*\.?[0-9]+)$/);
    if (scaled && scaled[1] === a) return parseFloat(scaled[2]) <= 1;
    // smoothstep(X, 0.0, ...) -- a bare identifier down to zero. Not provable in the strict
    // sense (X could be negative), but it is the falling-ramp idiom and nothing in these
    // shaders passes a negative size/radius/threshold as edge0. Starfield shipped exactly this.
    if (NUM.test(b) && parseFloat(b) === 0) return true;
  }
  // smoothstep(X + d, X, ...) with d > 0
  const off = a.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\+\s*([-+]?[0-9]*\.?[0-9]+)$/);
  if (off && off[1] === b.trim()) return parseFloat(off[2]) >= 0;
  return false;
}

// Split "a, b, c" at top level, so nested calls like max(x, y) do not confuse the edge split.
function topArgs(s) {
  const out = []; let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") { if (depth === 0) break; depth--; }
    else if (ch === "," && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

const hits = [];
lines.forEach((ln, i) => {
  let at = 0;
  for (;;) {
    const k = ln.indexOf("smoothstep(", at);
    if (k < 0) break;
    at = k + 11;
    const args = topArgs(ln.slice(at));
    if (args.length >= 2 && reversed(args[0], args[1]))
      hits.push((i + 1) + ": " + ln.trim().slice(0, 110));
  }
});

ok("no smoothstep with provably reversed edges", hits.length === 0,
   hits.length ? hits.length + " site(s):\n      " + hits.join("\n      ") : "");

// The check has to be able to SEE a reversal, or it is worth nothing. Feed it the exact five
// forms that shipped and assert every one is caught.
const KNOWN_BAD = [
  "float a = smoothstep(size, 0.0, dist);",
  "float b = smoothstep(uRad, uRad*0.85, r);",
  "float c = smoothstep(0.11, 0.0, length(fp));",
  "float d = smoothstep(uFoam + 0.22, uFoam, x);",
  "float e = smoothstep(1.0, 0.0, x);",
];
let caught = 0;
for (const bad of KNOWN_BAD) {
  const k = bad.indexOf("smoothstep(") + 11;
  const args = topArgs(bad.slice(k));
  if (reversed(args[0], args[1])) caught++;
}
ok("the detector catches all five shipped reversal shapes", caught === KNOWN_BAD.length,
   caught + "/" + KNOWN_BAD.length);

// ...and must NOT fire on the correct forms, including the nested max()/min() the Ocean now uses.
const KNOWN_GOOD = [
  "float a = smoothstep(0.0, size, dist);",
  "float b = 1.0 - smoothstep(uRad*0.85, uRad, r);",
  "float c = smoothstep(uFoam, max(uFoam + 0.02, min(0.995, uFoam + 0.22)), x);",
  "float d = smoothstep(0.0, 0.2, d)*(1.0 - smoothstep(0.85, 1.0, d));",
  "float e = smoothstep(lo, hi, x);",
];
let quiet = 0;
for (const good of KNOWN_GOOD) {
  let at = 0, fired = false;
  for (;;) {
    const k = good.indexOf("smoothstep(", at);
    if (k < 0) break;
    at = k + 11;
    const args = topArgs(good.slice(at));
    if (args.length >= 2 && reversed(args[0], args[1])) fired = true;
  }
  if (!fired) quiet++;
}
ok("the detector stays quiet on correct forms", quiet === KNOWN_GOOD.length, quiet + "/" + KNOWN_GOOD.length);

console.log(fails ? "\n" + fails + " FAILED" : "\nall good");
process.exit(fails ? 1 : 0);
