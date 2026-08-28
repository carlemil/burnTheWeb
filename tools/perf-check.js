#!/usr/bin/env node
// PER-EFFECT AND PER-FILTER COST, measured on the real GPU.
//
//   node tools/perf-check.js <outdir> [dev-index.html]
//
// then run the printed msedge lines. Results arrive as PERF <json> lines on stderr.
//
// WHY THIS EXISTS. CLAUDE.md carries one whole-frame table (the 4-layer default and
// Mandelbulb, two resolutions) and its conclusion is that the frame is not CPU-bound and the
// per-frame JS optimisations are all worthless. What it has never had is a PER-EFFECT number,
// so the three shader-side suspects it names have never been measured against the other 49
// effects, and no filter has ever been costed at all.
//
// Named -check, NOT *probe.js: /deploy runs `node tools/*probe.js` over this directory and
// those are node probes. This one needs a browser and a real GPU.
//
// THREE THINGS MAKE OR BREAK THE MEASUREMENT, all of them documented traps:
//
//  1. RUN IT IN REAL TIME -- no --virtual-time-budget. It fast-forwards the clock, which makes
//     every timing meaningless and (worse) still looks like a successful run. The printed
//     commands deliberately omit it.
//  2. STRIP THE LAYER'S FILTERS FIRST. An effect switch deliberately KEEPS the layer's filter
//     chain and the shipped starter carries twelve, Fire included -- so every effect would
//     otherwise be timed through a fire sim.
//  3. THE GPU TIMER IS THE ONLY INSTRUMENT THAT SEES ANYTHING. Headless caps at ~175 fps, so
//     wall-clock fps is pinned to the cap and reports every effect as identical. CPU time is
//     measured too and is NOT redundant: the point-accumulation effects stamp on the CPU, and
//     a GPU-only number would report the expensive ones as free.
//
// No backtick anywhere in the injected source; assembled from arrays joined by an explicit
// newline, per the rule in CLAUDE.md.
const fs = require("fs");
const path = require("path");
const NL = String.fromCharCode(10);
const Q = String.fromCharCode(39);

const outDir = process.argv[2];
const appFile = process.argv[3] || "dev-index.html";
// Optional: --only=Name,Name times just those effects and skips the filter sweep; --tag=x
// names the output page perf-x.html so several candidate builds can sit side by side.
const optOnly = (process.argv.find(a => a.startsWith("--only=")) || "").slice(7);
const ONLY = optOnly ? optOnly.split(",") : null;
const FILTERS_ONLY = process.argv.includes("--filters-only");   // skip the effect sweep
const TAG = (process.argv.find(a => a.startsWith("--tag=")) || "").slice(6) || "";
if (!outDir) { console.error("usage: node tools/perf-check.js <outdir> [dev-index.html]"); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
const app = fs.readFileSync(appFile, "utf8");

// ---- instrumentation ---------------------------------------------------------------------
// Bracket the frame's work: begin after the rAF re-arm, end once the render has been issued.
// creditDraw/cardDraw run after that and are Canvas2D on their own canvases, so they are
// deliberately outside the bracket.
// Anchored to the function line as well: the bare rAF call also appears once as the startup
// kick, and hooking THAT would begin a query outside any frame.
const HOOK_BEGIN = "function frame(now) {" + NL + "    requestAnimationFrame(frame);";
const HOOK_END = "if (useGL) glRender();";
for (const h of [HOOK_BEGIN, HOOK_END]) {
  const n = app.split(h).length - 1;
  if (n !== 1) throw new Error("hook '" + h + "' matched " + n + " times, expected exactly 1");
}

const PERF = [
  "  var __pfQ = [], __pfPool = [], __pfExt = null, __pfCur = null, __pfReady = false, __pfT0 = 0;",
  "  window.__perf = { gpu: [], cpu: [], frames: 0, ext: null, w: 0, h: 0 };",
  "  function __pfBegin() {",
  "    if (typeof useGL === 'undefined' || !useGL || typeof gl === 'undefined' || !gl) return;",
  "    if (!__pfReady) {",
  "      __pfReady = true;",
  "      __pfExt = gl.getExtension('EXT_disjoint_timer_query_webgl2');",
  "      window.__perf.ext = !!__pfExt;",
  "    }",
  "    __pfT0 = performance.now();",
  "    if (!__pfExt) return;",
  "    // frame() has early-return branches (paused, and others). If one fired between a begin",
  "    // and its end the query is still open, and beginQuery on top of an open one is an",
  "    // INVALID_OPERATION that would poison every later sample. Close and discard it.",
  "    if (__pfCur) { try { gl.endQuery(__pfExt.TIME_ELAPSED_EXT); } catch (e) {} __pfPool.push(__pfCur); __pfCur = null; }",
  "    var q = __pfPool.pop() || gl.createQuery();",
  "    try { gl.beginQuery(__pfExt.TIME_ELAPSED_EXT, q); __pfCur = q; }",
  "    catch (e) { __pfPool.push(q); __pfCur = null; }",
  "  }",
  "  function __pfEnd() {",
  "    if (typeof useGL === 'undefined' || !useGL || typeof gl === 'undefined' || !gl) return;",
  "    window.__perf.cpu.push(performance.now() - __pfT0);",
  "    window.__perf.frames++;",
  "    var cv = document.getElementById('fire');",
  "    if (cv) { window.__perf.w = cv.width; window.__perf.h = cv.height; }",
  "    if (!__pfExt) return;",
  "    if (__pfCur) { gl.endQuery(__pfExt.TIME_ELAPSED_EXT); __pfQ.push(__pfCur); __pfCur = null; }",
  "    // Results lag the frame that issued them by a few frames, so drain whatever is ready.",
  "    // A DISJOINT means the GPU was interrupted and every outstanding result is garbage.",
  "    var dis = gl.getParameter(__pfExt.GPU_DISJOINT_EXT);",
  "    for (var i = __pfQ.length - 1; i >= 0; i--) {",
  "      var qq = __pfQ[i];",
  "      if (gl.getQueryParameter(qq, gl.QUERY_RESULT_AVAILABLE)) {",
  "        if (!dis) window.__perf.gpu.push(gl.getQueryParameter(qq, gl.QUERY_RESULT) / 1.0e6);",
  "        __pfQ.splice(i, 1); __pfPool.push(qq);",
  "      }",
  "    }",
  "  }",
  "",
].join(NL);

const HOOK_FLT = "  function closeFilterPicker() {";
if (app.split(HOOK_FLT).length - 1 !== 1) throw new Error("filter hook did not match exactly once");
function instrument(src) {
  let s = src.replace(HOOK_BEGIN, HOOK_BEGIN + " __pfBegin();");
  // THE ONE REAL TOGGLE, exposed. The app is one IIFE, so a page script cannot reach",
  // setFilterOn; the picker's checkboxes are the only UI route in and driving them from a",
  // synthetic click failed three different ways (hidden value-store boxes nobody listens",
  // to; a closed layer box; a dialog that never opened). Splicing the hook is a one-line",
  // instrumentation, exactly like the timing bracket, and it cannot be out of date.",
  s = s.replace(HOOK_FLT, "  window.__setFilterOn = setFilterOn; window.__filterIds = function(){ return FILTERS.map(function(f){ return f.id; }); };" + NL + HOOK_FLT);
  s = s.replace(HOOK_END, "__pfEnd(); " + HOOK_END);
  // Declared just above the frame loop; `var` and function declarations only, so nothing is
  // in a temporal dead zone whichever slice ends up calling first.
  s = s.replace("  function frame(now) {" + NL, PERF + "  function frame(now) {" + NL);
  return s;
}

const SEED = [
  "(function(){",
  "  try {",
  "    localStorage.clear();",
  "    localStorage.setItem(\"burnTheWeb.v1\", JSON.stringify({ panelOpen: true, cycle: false, tdur: [0, 0] }));",
  "    localStorage.setItem(\"burnTheWeb.tutorial.v1\", \"1\");",
  "    localStorage.setItem(\"burnTheWeb.credits.v1\", \"off\");",
  "    localStorage.setItem(\"burnTheWeb.sync.v1\", JSON.stringify({ shows: 9, done: true }));",
  "  } catch (e) {}",
  "  window.__errs = 0;",
  "  var ce = console.error;",
  "  console.error = function(){ window.__errs++; ce.apply(console, arguments); };",
  "  window.addEventListener(\"error\", function(){ window.__errs++; });",
  "})();",
].join(NL);

// SETTLE_MS is generous on purpose: a feedback filter needs SECONDS to reach steady state
// (CLAUDE.md records Fire looking inert when judged after 450ms), and several effects seed
// themselves on entry. Sampling a transient would measure the wrong thing.
const ASSERT = [
  "(function(){",
  "  var SETTLE = 1100, SAMPLE = 900, MIN_S = 8;",
  "  var out = [];",
  "  function vis(l){ return [].slice.call(l).filter(function(n){ return n.offsetParent !== null; }); }",
  "  function med(a){",
  "    if (!a.length) return null;",
  "    var b = a.slice().sort(function(x, y){ return x - y; });",
  "    var m = Math.floor(b.length / 2);",
  "    return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;",
  "  }",
  "  function f(v){ return v == null ? \"\" : (typeof v === \"number\" ? Math.round(v*1000)/1000 : v); }",
  "  function say(o){ console.log([\"PERF\", f(o.kind), f(o.name), f(o.gpu), f(o.cpu), f(o.n), f(o.nc), f(o.w), f(o.h), f(o.thin), f(o.drifted), f(o.ext), f(o.layers)].join(\"|\")); }",
  "  function reset(){ window.__perf.gpu.length = 0; window.__perf.cpu.length = 0; }",
  "",
  "  // MEDIAN, not mean: GPU timing has outliers (a compositor hiccup, a driver stall) and a",
  "  // mean lets a single one swamp a whole sample window.",
  "  function measure(label, kind, done){",
  "    setTimeout(function(){",
  "      reset();",
  "      setTimeout(function(){",
  "        var g = window.__perf.gpu.slice(), c = window.__perf.cpu.slice();",
  "        say({ kind: kind, name: label, gpu: med(g), cpu: med(c), n: g.length, nc: c.length,",
  "              w: window.__perf.w, h: window.__perf.h, thin: g.length < MIN_S });",
  "        done();",
  "      }, SAMPLE);",
  "    }, SETTLE);",
  "  }",
  "",
  "  function eachSeries(items, step, done){",
  "    var i = 0;",
  "    (function next(){ if (i >= items.length) return done(); step(items[i++], next); })();",
  "  }",
  "",
  "  function go(){",
  "    var sel = vis(document.querySelectorAll(\"select.lyr-name\"))[0];",
  "    if (!sel) { say({ kind: \"fatal\", name: \"no layer row\" }); return console.log(\"PERF DONE\"); }",
  "    // STRIP THE CHAIN. The shipped starter carries twelve filters; an effect switch keeps",
  "    // them, so without this every effect below is timed through a fire sim.",
  "    // Through the hook, not the ✕ buttons -- those live in the layer box, which starts",
  "    // closed, so vis() finds none of them. The chain length after is LOGGED, so a run",
  "    // that timed every effect through twelve filters would say so instead of looking fine.",
  "    var ids0 = window.__filterIds ? window.__filterIds() : [];",
  "    ids0.forEach(function(id){ window.__setFilterOn(id, false); });",
  "    var chain = document.querySelectorAll(\".filter-sec:not([hidden])\").length;",
  "    say({ kind: \"setup\", name: \"stripped\", n: ids0.length, layers: vis(document.querySelectorAll(\"select.lyr-name\")).length, drifted: chain ? \"chain=\" + chain : \"\" });",
  "",
  "    var ONLY = " + JSON.stringify(ONLY) + ";",
  "    var names = [].slice.call(sel.options).map(function(o){ return o.textContent.trim(); });",
  "    if (ONLY) names = names.filter(function(n){ return ONLY.indexOf(n) >= 0; });",
  "    if (" + FILTERS_ONLY + ") names = [];",
  "    say({ kind: \"setup\", name: \"effects\", n: names.length });",
  "",
  "    eachSeries(names, function(nm, next){",
  "      var o = [].slice.call(sel.options).filter(function(x){ return x.textContent.trim() === nm; })[0];",
  "      sel.value = o.value; sel.dispatchEvent(new Event(\"change\", { bubbles: true }));",
  "      measure(nm, \"effect\", function(){",
  "        // The effect under test must STILL be selected when the sample was taken -- an",
  "        // auto-cycle or a stray handler moving on would silently time the wrong thing.",
  "        var now = sel.options[sel.selectedIndex].textContent.trim();",
  "        if (now !== nm) say({ kind: \"warn\", name: nm, drifted: now });",
  "        next();",
  "      });",
  "    }, function(){",
  "      if (ONLY) { say({ kind: \"end\", name: \"errs\", n: window.__errs, ext: window.__perf.ext }); console.log(\"PERF DONE\"); try { window.close(); } catch (e) {} return; }",
  "      filters(sel);",
  "    });",
  "  }",
  "",
  "  function filters(sel){",
  "    // A cheap, steady base so the difference is the filter and not the effect underneath.",
  "    var base = [].slice.call(sel.options).filter(function(x){ return x.textContent.trim() === \"Plasma\"; })[0];",
  "    if (base) { sel.value = base.value; sel.dispatchEvent(new Event(\"change\", { bubbles: true })); }",
  "    // THE PICKER IS THE ONLY LIVE TOGGLE. The hidden #flt-<id> checkboxes are the value",
  "    // store and nothing listens to them -- a first version ticked those and measured every",
  "    // filter as a small NEGATIVE cost, because none of them ever ran. The picker's rows",
  "    // carry data-fid and their change handler is setFilterOn, the one real path in.",
  "    // The picker opens from the layer box's Filters tab, and every layer box starts CLOSED",
  "    // (openSlots is empty and selecting does not open). Open slot 0, switch its tab, then",
  "    // press Add filter. A first version skipped this and found zero rows.",
  "    // LAZY: the hook is spliced above the registry const, so reading FILTERS there is a TDZ.",
  "    var ids = window.__filterIds ? window.__filterIds() : [];",
  "    say({ kind: \"setup\", name: \"filters\", n: ids.length });",
  "    // The picker rebuilds its rows on every toggle (syncFilterPicker), so look each one up",
  "    // by id at the moment it is needed rather than holding a node that has been replaced.",
  "    function set(id, on){ window.__setFilterOn(id, on); }",
  "    // Ground truth for 'was it really in the chain': the visible ✕ rows of the layer list.",
  "    function inChain(id){ return !!document.querySelector(\".filter-sec[data-fid=\" + JSON.stringify(id) + \"]:not([hidden])\"); }",
  "    measure(\"__base__\", \"base\", function(){",
  "      eachSeries(ids, function(id, next){",
  "        set(id, true);",
  "        measure(id, \"filter\", function(){",
  "          // Assert it really was in the chain when sampled, then take it back out.",
  "          if (!inChain(id)) say({ kind: \"warn\", name: id, drifted: \"not-in-chain\" });",
  "          set(id, false);",
  "          next();",
  "        });",
  "      }, function(){",
  "        // BASE AGAIN, AT THE END. The first base is the first thing sampled after boot and",
  "        // can catch driver warm-up; at 4K it read high enough that several cheap filters",
  "        // came out with NEGATIVE cost. Reporting both lets the reader take the smaller.",
  "        measure(\"__base2__\", \"base\", function(){",
  "          say({ kind: \"end\", name: \"errs\", n: window.__errs, ext: window.__perf.ext });",
  "          console.log(\"PERF DONE\");",
  "          try { window.close(); } catch (e) {}",
  "        });",
  "      });",
  "    });",
  "  }",
  "",
  "  window.addEventListener(\"error\", function(e){ say({ kind: \"fatal\", name: String(e.message) }); console.log(\"PERF DONE\"); try { window.close(); } catch (x) {} });",
  "  if (window.__appReady) setTimeout(go, 1500);",
  "  else addEventListener(\"app:ready\", function(){ setTimeout(go, 1500); }, { once: true });",
  "})();",
].join(NL);

let s = instrument(app);
s = s.replace("<head>", "<head>" + NL + "<script>" + SEED + "<" + "/script>");
s = s.replace("</body>", "<script>" + ASSERT + "<" + "/script>" + NL + "</body>");
const f = path.join(outDir, "perf" + (TAG ? "-" + TAG : "") + (FILTERS_ONLY ? "-flt" : "") + ".html");
fs.writeFileSync(f, s);
console.log("wrote " + f);

const abs = path.resolve(outDir).split(path.sep).join("/");
console.log(NL + "run BOTH resolutions, with NO --virtual-time-budget (it would make every"
  + NL + "number meaningless while still looking like a successful run):");
for (const r of [["1600,900", "hd"], ["3840,2160", "4k"]]) {
  console.log(NL + "  [" + r[1] + "] msedge --headless=new --disable-extensions --enable-logging=stderr --v=0"
    + " --window-size=" + r[0]
    + " --user-data-dir=\"" + abs + "/ud-perf-" + r[1] + "\""
    + " \"file:///" + abs + "/perf.html\" 2>&1 | grep -a -oE " + Q + "\"PERF[^\"]*\"" + Q
    + " > " + abs + "/perf-" + r[1] + ".txt");
}
