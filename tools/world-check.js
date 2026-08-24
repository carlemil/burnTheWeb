#!/usr/bin/env node
// Shared-3D-world BROWSER check: joining and leaving a world must raise NO console error.
//
//   node tools/world-check.js <outdir> [dev-index.html]
//
// then run the printed msedge command. Every line is PASS/FAIL on stderr via CONSOLE.
//
// WHY THIS EXISTS, and why neither existing world tool covers it. `tools/worldprobe.js` is a
// static source/brace probe and `tools/worldcompile-check.js` only COMPILES the 16 group
// combinations -- neither runs a frame. Two real defects lived in exactly that blind spot:
//
//   1. glWorldMix rendered into glFbo.layer while sampling glTex.layer, its own colour
//      attachment. That is a WebGL2 feedback loop, so the driver REJECTED THE DRAW and it
//      silently did nothing: joining a world read as a cut instead of the 0.45s crossfade,
//      and leaving one showed the layer black for the whole fade. A dropped draw produces
//      no exception and no visible crash -- only a GL console error.
//   2. A `const base` inside renderStackColor's loop shadowed the function's own `base`
//      parameter, so reading the parameter there threw "Cannot access 'base' before
//      initialization" on EVERY FRAME of a world join. 25 errors in under a second.
//
// Both are invisible to a screenshot (the picture looks plausible) and invisible to every
// node probe. The console-error count is the instrument that sees them, which is the same
// argument CLAUDE.md makes for asserting zero console errors after a shader change.
//
// It is deliberately NOT named *probe.js: /deploy runs `node tools/*probe.js` over the
// directory, and this one needs a browser.
//
// No backtick anywhere in the injected source; it is assembled from arrays joined by an
// explicit newline rather than template literals.
const fs = require("fs");
const path = require("path");
const NL = String.fromCharCode(10);
const Q = String.fromCharCode(39);

const outDir = process.argv[2];
const appFile = process.argv[3] || "dev-index.html";
if (!outDir) { console.error("usage: node tools/world-check.js <outdir> [dev-index.html]"); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
const app = fs.readFileSync(appFile, "utf8");

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

const ASSERT = [
  "(function(){",
  "  var fails = 0;",
  "  function ok(name, cond, extra){",
  "    // NAME FIRST -- swapped, every assertion passes unconditionally (a non-empty string is",
  "    // always truthy). Same self-enforcing signature as the other browser checks.",
  "    if (typeof name !== \"string\") {",
  "      console.log(\"FAIL  ok() called with its arguments swapped: \" + name + \" / \" + cond);",
  "      fails++; return;",
  "    }",
  "    console.log((cond ? \"PASS  \" : \"FAIL  \") + name + (extra ? \"  [\" + extra + \"]\" : \"\"));",
  "    if (!cond) fails++;",
  "  }",
  "  function vis(list){ return [].slice.call(list).filter(function(n){ return n.offsetParent !== null; }); }",
  "  function setFx(name){",
  "    var r = vis(document.querySelectorAll(\"select.lyr-name\"))[0];",
  "    var o = [].slice.call(r.options).filter(function(o){ return o.textContent.trim() === name; })[0];",
  "    if (!o) return false;",
  "    r.value = o.value; r.dispatchEvent(new Event(\"change\", { bubbles: true }));",
  "    return true;",
  "  }",
  "",
  "  setTimeout(function(){",
  "    ok(\"the app started clean\", window.__errs === 0, window.__errs + \" console errors\");",
  "    // Ocean is the world's ground and its camera owner, so it is the one participant that",
  "    // makes a one-layer world meaningful.",
  "    if (!setFx(\"Ocean\")) { ok(\"Ocean is in the effect list\", false); console.log(\"DONE fails=\" + fails); return; }",
  "    var chev = document.querySelector(\"#panel .lyr button.lyr-pop\");",
  "    if (chev) chev.click();",
  "    setTimeout(function(){",
  "      var w = vis(document.querySelectorAll(\"[data-k=world]\"))[0];",
  "      ok(\"the Share one 3D world tick is reachable\", !!w);",
  "      if (!w) { console.log(\"DONE fails=\" + fails); return; }",
  "      var before = window.__errs;",
  "      w.checked = true; w.dispatchEvent(new Event(\"change\", { bubbles: true }));",
  "      // Long enough to cover WORLD_FADE_S (0.45s) plus the async program link, so the",
  "      // crossfade branch -- the one that renders BOTH pictures and mixes them -- really runs.",
  "      setTimeout(function(){",
  "        ok(\"joining a world raises no console error\", window.__errs === before,",
  "           (window.__errs - before) + \" new errors\");",
  "        var mid = window.__errs;",
  "        w.checked = false; w.dispatchEvent(new Event(\"change\", { bubbles: true }));",
  "        // LEAVING is the half that showed a black layer for the whole fade: the branch",
  "        // clears glTex.layer and then mixes, so a dropped mix leaves nothing at all.",
  "        setTimeout(function(){",
  "          ok(\"leaving a world raises no console error\", window.__errs === mid,",
  "             (window.__errs - mid) + \" new errors\");",
  "          ok(\"no console errors across the whole join/leave cycle\", window.__errs === 0,",
  "             window.__errs + \" errors\");",
  "          console.log(\"DONE fails=\" + fails);",
  "        }, 1000);",
  "      }, 1200);",
  "    }, 700);",
  "  }, 1800);",
  "})();",
].join(NL);

let s = app.replace("<head>", "<head>" + NL + "<script>" + SEED + "<" + "/script>");
s = s.replace("</body>", "<script>" + ASSERT + "<" + "/script>" + NL + "</body>");
if (s === app) throw new Error("injection failed");
const f = path.join(outDir, "world.html");
fs.writeFileSync(f, s);
console.log("wrote " + f);

const abs = path.resolve(outDir).split(path.sep).join("/");
console.log(NL + "run with:");
console.log("  msedge --headless=new --disable-extensions --enable-logging=stderr --v=0"
  + " --window-size=1280,800 --virtual-time-budget=40000"
  + " --user-data-dir=\"" + abs + "/ud-world\""
  + " \"file:///" + abs + "/world.html\" 2>&1 | grep -oE " + Q + "\"(PASS|FAIL|DONE)[^\"]*\"" + Q);
