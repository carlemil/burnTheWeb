#!/usr/bin/env node
// WORLD PROGRAM LINK TIME. Links every #define combination of the world shader on the real GPU
// and reports how long each took.
//
//   node tools/worldlink-check.js <outdir> [dev-index.html]
//   then run the printed msedge command; one LINK line per combination.
//
// WHY THIS EXISTS, and why worldcompile-check cannot stand in for it. That one COMPILES the
// sixteen fragment shaders and deliberately stops there -- its own comment says "compile only --
// a LINK is the 64-second stall". Compiling all sixteen takes about a second. LINKING them, at
// the time this was written, took 399 seconds:
//
//     ocean-only   0.1s     glass          7.7s
//     solids       0.9s     glass+solids  19.8s
//     qjulia       0.8s     glass+qjulia  17.6s
//     vballs       1.1s     gb+sd+qj      47.6s
//     sd+qj+vb     3.4s     gb+sd+vb      65.6s
//                           ALL FIVE     133.8s
//
// Two things fall out of that table and neither was written down anywhere before it was
// measured. First, GLASS IS THE WHOLE COST: every combination containing it is 7.7-134s and
// every combination without it is under 3.4s. Second, the five-way is roughly DOUBLE the 64s
// recorded in CLAUDE.md -- that figure predates the W_GBN and #if fixes and had not been
// re-measured since, so the number everyone was reasoning from was stale in the wrong direction.
//
// The cost matters because it is paid at RUNTIME, synchronously from the driver's point of view,
// the first time a user ticks "Share one 3D world" on a combination nobody has built before.
// v1.37.0 shipped exactly this as a hang. The link is asynchronous now (KHR_parallel_shader_compile,
// polled), so it does not freeze the tab -- but a world that takes two minutes to appear is still
// a broken feature, and nothing in the repo could see it coming.
//
// HOW IT MEASURES, and the two traps:
//   * NO --virtual-time-budget. Virtual time fast-forwards through exactly the stall being
//     measured; under it, performance.now() around a link reports single-digit milliseconds for
//     work that takes a minute. Same reason startup-check.sh exists and measures the wall clock.
//   * READING LINK_STATUS is what forces the wait. linkProgram alone returns immediately and the
//     driver optimises in the background, so a harness that skips the read times nothing.
// Trust the shell's own `date` around the whole invocation as the ground truth; the per-
// combination numbers are the breakdown that tells you WHICH combination regressed.
//
// Expect run-to-run variation of ±15% on individual combinations; compare totals, not entries,
// and re-run before believing a small change either way.
"use strict";
const fs = require("fs"), path = require("path");
const NL = String.fromCharCode(10), Q = String.fromCharCode(39);
const outDir = process.argv[2], file = process.argv[3] || "dev-index.html";
if (!outDir) { console.error("usage: node tools/worldlink-check.js <outdir> [file]"); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
const s = fs.readFileSync(file, "utf8");
const cut = (from, to, start) => { const a = s.indexOf(from, start || 0) + from.length; return s.slice(a, s.indexOf(to, a)); };
const body = cut("const FS_WORLD = `", "`;");
const vsq = cut("const VS_QUAD = `", "`;");
const cam = cut("function camGlsl() { return `", "`; }");

// The same sixteen worldSource() builds, and the same W_GBN convention worldcompile-check uses:
// >= 1 always, 2 when glass is present so the multi-group loops compile.
const variants = [];
for (let m = 0; m < 16; m++) {
  const on = b => (m >> b) & 1;
  const key = ["gb", "sd", "qj", "vb"].filter((k, i) => on(i)).join("+") || "ocean-only";
  const def = NL + "#define W_GB " + on(0) + NL + "#define W_SD " + on(1) + NL + "#define W_QJ " + on(2)
    + NL + "#define W_VB " + on(3) + NL + "#define W_GBN " + (on(0) ? 2 : 1) + NL;
  const fsSrc = body.replace("#version 300 es" + NL, "#version 300 es" + def)
    .replace(/gl_FragCoord/g, "fragCam").replace("void main(){", cam + NL + "    void main(){ vec4 fragCam = camFrag4();");
  variants.push({ key, fsSrc });
}

const page = [
  "<canvas id=c width=8 height=8></canvas><script>",
  "var gl = document.getElementById('c').getContext('webgl2');",
  "var V = " + JSON.stringify(variants) + ", VS = " + JSON.stringify(vsq) + ";",
  "var vs = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(vs, VS); gl.compileShader(vs);",
  "var bad = 0, total = 0;",
  "V.forEach(function(v){",
  "  var f = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(f, v.fsSrc); gl.compileShader(f);",
  "  if (!gl.getShaderParameter(f, gl.COMPILE_STATUS)) {",
  "    bad++;",
  "    console.log('LINK FAIL ' + v.key + ' :: did not COMPILE :: ' + gl.getShaderInfoLog(f).split(String.fromCharCode(10))[0]);",
  "    gl.deleteShader(f); return;",
  "  }",
  "  var t0 = performance.now();",
  "  var p = gl.createProgram();",
  "  gl.attachShader(p, vs); gl.attachShader(p, f);",
  "  gl.linkProgram(p);",
  // Reading LINK_STATUS is the blocking call. Without it the driver defers and this measures nothing.
  "  var ok = gl.getProgramParameter(p, gl.LINK_STATUS);",
  "  var ms = performance.now() - t0;",
  "  total += ms;",
  "  if (!ok) { bad++; console.log('LINK FAIL ' + v.key + ' :: ' + gl.getProgramInfoLog(p).split(String.fromCharCode(10))[0]); }",
  "  else console.log('LINK ok   ' + v.key + '  ' + ms.toFixed(0) + ' ms');",
  "  gl.deleteProgram(p); gl.deleteShader(f);",
  "});",
  "console.log('LINK DONE bad=' + bad + ' of ' + V.length + '  total ' + (total/1000).toFixed(1) + 's');",
  "window.close();",
  "<" + "/script>",
].join(NL);

const out = path.join(outDir, "worldlink.html");
fs.writeFileSync(out, page);
const abs = path.resolve(outDir).split(path.sep).join("/");
console.log("wrote " + out);
console.log(NL + "run it with NO --virtual-time-budget (it would skip the stall), and time the whole thing:");
console.log("  start=$(date +%s); msedge --headless=new --disable-extensions --disable-gpu-shader-disk-cache \\");
console.log("    --enable-logging=stderr --v=0 --user-data-dir=\"" + abs + "/ud-worldlink\" \\");
console.log("    \"file:///" + abs + "/worldlink.html\" 2>&1 | grep -a -oE " + Q + "\"LINK[^\"]*\"" + Q + "; \\");
console.log("    echo \"wall $(( $(date +%s) - start ))s\"");
console.log(NL + "--disable-gpu-shader-disk-cache matters: without it a second run reads a warm cache and");
console.log("reports about a second for the lot, which is not the number a first-time user pays.");
