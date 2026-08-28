#!/usr/bin/env node
// PIXEL GATE: does a build render a SHADER effect bit-identically to another build?
//
//   node tools/pixgate.js <outdir> <page.html> <tag> <Effect name> [<Effect name> ...]
//
// then run the printed msedge line; it prints one PIX|<tag>|<effect>|<hash> per effect. Run it
// once per build and diff the hashes. Same hash = pixel-identical; a "free" optimisation is
// one that reproduces the hash.
//
// THE RULES THAT MAKE THIS REPRODUCIBLE, all from CLAUDE.md's Testing section:
//  - Stub rAF in <head>, BEFORE the app, and OWN the callback queue with a fixed 1/60 step, so
//    every clock the frame derives from `now` advances identically on both builds.
//  - Do NOT clear the rAF queue: frame() re-arms itself, and the stub drains the queue by
//    calling whatever was registered, so the loop is driven by the harness.
//  - Stub Math.random -- drift segments and palette cycling draw from it.
//  - Read pixels with readPixels IN THE SAME TASK as the last frame; after the task ends the
//    drawing buffer has been composited and reads back empty.
//  - SHADER EFFECTS ONLY. Point effects are not bit-reproducible under this harness (their
//    chaos PRNG is reseeded per frame but the point budget per tick is not) -- gate those on
//    logic, never here.
//  - THE GATE IS BISTABLE. A single mismatch is inconclusive: no-filter Plasma matches ~9/10.
//    Re-run a mismatch 2-3 times before believing it.
//
// No backtick anywhere in the injected source; arrays joined by an explicit newline.
const fs = require("fs");
const path = require("path");
const NL = String.fromCharCode(10);
const Q = String.fromCharCode(39);

const [outDir, pageFile, tag, ...effects] = process.argv.slice(2);
if (!outDir || !pageFile || !tag || !effects.length) {
  console.error("usage: node tools/pixgate.js <outdir> <page.html> <tag> <Effect name> [...]");
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });
const app = fs.readFileSync(pageFile, "utf8");

const HEAD = [
  "(function(){",
  "  try {",
  "    localStorage.clear();",
  "    localStorage.setItem(\"burnTheWeb.v1\", JSON.stringify({ panelOpen: true, cycle: false, tdur: [0, 0] }));",
  "    localStorage.setItem(\"burnTheWeb.tutorial.v1\", \"1\");",
  "    localStorage.setItem(\"burnTheWeb.credits.v1\", \"off\");",
  "    localStorage.setItem(\"burnTheWeb.sync.v1\", JSON.stringify({ shows: 9, done: true }));",
  "  } catch (e) {}",
  "  // A deterministic Math.random: xorshift32 from a fixed seed, so both builds draw the",
  "  // same drift segments and the same palette picks.",
  "  var st = 0x9E3779B9;",
  "  Math.random = function(){ st ^= st << 13; st ^= st >>> 17; st ^= st << 5; return ((st >>> 0) % 1000000) / 1000000; };",
  "  // Own the rAF queue. The app registers frame(), we call it with a clock that advances",
  "  // exactly 1/60 s per pump, and it re-registers itself into our queue.",
  "  var q = [], t = 1000;",
  "  window.requestAnimationFrame = function(cb){ q.push(cb); return q.length; };",
  "  window.cancelAnimationFrame = function(){};",
  "  window.__pump = function(n){",
  "    for (var i = 0; i < n; i++){",
  "      var cur = q; q = []; t += 1000 / 60;",
  "      for (var j = 0; j < cur.length; j++) cur[j](t);",
  "    }",
  "  };",
  "  window.__errs = 0;",
  "  var ce = console.error; console.error = function(){ window.__errs++; ce.apply(console, arguments); };",
  "  window.addEventListener(\"error\", function(){ window.__errs++; });",
  "})();",
].join(NL);

const BODY = [
  "(function(){",
  "  var EFFECTS = " + JSON.stringify(effects) + ";",
  "  var TAG = " + JSON.stringify(tag) + ";",
  "  function vis(l){ return [].slice.call(l).filter(function(n){ return n.offsetParent !== null; }); }",
  "  // FNV-1a over the pixel bytes -- cheap, and a one-byte change anywhere flips it.",
  "  function hashPix(){",
  "    var cv = document.getElementById(\"fire\");",
  "    var gl = cv.getContext(\"webgl2\");",
  "    var w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;",
  "    var px = new Uint8Array(w * h * 4);",
  "    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);",
  "    var hsh = 0x811c9dc5, nz = 0;",
  "    for (var i = 0; i < px.length; i++){ hsh ^= px[i]; hsh = Math.imul(hsh, 0x01000193); if (px[i]) nz++; }",
  "    return (hsh >>> 0).toString(16) + \":\" + w + \"x\" + h + \":nz\" + nz;",
  "  }",
  "  function go(){",
  "    // Let the app initialise: a few pumped frames stand in for the boot rAFs.",
  "    window.__pump(4);",
  "    var sel = vis(document.querySelectorAll(\"select.lyr-name\"))[0];",
  "    vis(document.querySelectorAll(\".filter-rm\")).forEach(function(b){ b.click(); });",
  "    EFFECTS.forEach(function(nm){",
  "      var o = [].slice.call(sel.options).filter(function(x){ return x.textContent.trim() === nm; })[0];",
  "      if (!o){ console.log(\"PIX|\" + TAG + \"|\" + nm + \"|MISSING\"); return; }",
  "      sel.value = o.value; sel.dispatchEvent(new Event(\"change\", { bubbles: true }));",
  "      // 90 frames = 1.5 s of scene time, well past any onEnter seed; the LAST pump and the",
  "      // readPixels are in this same task, which is the rule.",
  "      window.__pump(90);",
  "      console.log(\"PIX|\" + TAG + \"|\" + nm + \"|\" + hashPix());",
  "    });",
  "    console.log(\"PIX|\" + TAG + \"|__errs__|\" + window.__errs);",
  "    console.log(\"PIX DONE\");",
  "    try { window.close(); } catch (e) {}",
  "  }",
  "  if (window.__appReady) go(); else addEventListener(\"app:ready\", go, { once: true });",
  "})();",
].join(NL);

let s = app.replace("<head>", "<head>" + NL + "<script>" + HEAD + "<" + "/script>");
s = s.replace("</body>", "<script>" + BODY + "<" + "/script>" + NL + "</body>");
if (s === app) throw new Error("injection failed");
const f = path.join(outDir, "pix-" + tag + ".html");
fs.writeFileSync(f, s);
console.log("wrote " + f);
const abs = path.resolve(outDir).split(path.sep).join("/");
console.log("  msedge --headless=new --disable-extensions --enable-logging=stderr --v=0 --window-size=1280,800"
  + " --virtual-time-budget=15000 --user-data-dir=\"" + abs + "/ud-pix-" + tag + "\""
  + " \"file:///" + abs + "/pix-" + tag + ".html\" 2>&1 | grep -a -oE " + Q + "\"PIX[^\"]*\"" + Q);
