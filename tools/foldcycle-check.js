#!/usr/bin/env node
// Phase 0b BROWSER check: the auto-cycle gate, the palette fold, and the first-visit panel
// default. Three claims that only exist in a live DOM, so unlike every tools/*probe.js this
// one needs a browser -- which is exactly why it is NOT named *probe.js: /deploy runs
// `node tools/*probe.js` over the directory and would choke on it.
//
//   node tools/foldcycle-check.js <outdir> [dev-index.html]
//   msedge --headless=new --disable-extensions --enable-logging=stderr --v=0 //          --virtual-time-budget=60000 --user-data-dir=<outdir>/ud-<case> //          file:///C:/.../<case>.html
//
// (it prints the exact commands). Every line is PASS/FAIL on stderr via CONSOLE.
//
// THE ONE ASSERTION THAT BITES is case-open's "no switch while the editor is open".
// Verified sensitive: delete `if (editorOpen())` from the built file and it goes red
// (Fetingen -> Round and round). The mirror-image check -- open the panel mid-run and
// watch the cycle stop -- was written, measured, and DELETED: it passes against a build
// with the gate removed, because after a mid-run state change headless renders two frames
// in twenty virtual seconds and nothing would have switched either way. A green assertion
// that cannot go red is worse than none.
//
// No backtick anywhere in the injected source, and the two blocks are arrays joined by an
// explicit newline rather than template literals -- both traps documented in CLAUDE.md.
const fs = require("fs");
const path = require("path");
const NL = String.fromCharCode(10);
const Q = String.fromCharCode(39);   // a single quote, inside a single-quoted string

const outDir = process.argv[2];
const appFile = process.argv[3] || "dev-index.html";
if (!outDir) { console.error("usage: node tools/foldcycle-check.js <outdir> [dev-index.html]"); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
const app = fs.readFileSync(appFile, "utf8");

// Runs BEFORE the app: seeds localStorage and silences the credits, the tutorial and the
// sync nudge, all of which would otherwise cover the page or eat the clock.
const SEED_JS = [
  "// Runs BEFORE the app. Seeds localStorage and silences everything that would otherwise",
  "// cover the page or eat the clock (credits, tutorial, the sync nudge).",
  "(function () {",
  "  var seed = __SEED__;",
  "  try {",
  "    localStorage.clear();",
  "    if (seed) localStorage.setItem(\"burnTheWeb.v1\", JSON.stringify(seed));",
  "    localStorage.setItem(\"burnTheWeb.tutorial.v1\", \"1\");",
  "    localStorage.setItem(\"burnTheWeb.credits.v1\", \"off\");",
  "    localStorage.setItem(\"burnTheWeb.sync.v1\", JSON.stringify({ shows: 9, done: true }));",
  "  } catch (e) {}",
  "})();"
].join(NL);

// Runs AFTER the app.
const ASSERT_JS = [
  "// Runs after the app. Real rAF is left alone -- cyclePresets only ticks inside frame().",
  "(function () {",
  "  var CASE = __CASE__, fails = 0;",
  "  function ok(name, cond, extra) {",
  "    // NAME FIRST -- swapping the pair makes every assertion pass, because a name is a",
  "    // non-empty string and therefore always a truthy condition. Enforced rather than",
  "    // remembered: it has hidden a real miss behind a green line before.",
  "    if (typeof name !== \"string\") {",
  "      console.log(\"FAIL  \" + CASE + \" :: ok() called with its arguments swapped\");",
  "      fails++; return;",
  "    }",
  "    console.log((cond ? \"PASS  \" : \"FAIL  \") + CASE + \" :: \" + name + (extra ? \"  [\" + extra + \"]\" : \"\"));",
  "    if (!cond) fails++;",
  "  }",
  "  var panel = document.getElementById(\"panel\");",
  "  var hidden = function () { return panel.classList.contains(\"hidden\"); };",
  "  var sceneName = function () { var n = document.getElementById(\"scenenow\"); return n ? n.textContent : \"?\"; };",
  "  var pressM = function () { window.dispatchEvent(new KeyboardEvent(\"keydown\", { key: \"m\", bubbles: true })); };",
  "",
  "  if (CASE === \"case-first\") {",
  "    ok(\"first visit starts with the panel hidden\", hidden());",
  "    console.log(\"DONE \" + CASE + \" fails=\" + fails);",
  "    return;",
  "  }",
  "  if (CASE === \"case-closed\") {",
  "    ok(\"a stored panelOpen:false stays hidden\", hidden());",
  "    // With the editor hidden the cycler must actually run...",
  "    var start = sceneName();",
  "    setTimeout(function () {",
  "      ok(\"auto-cycle runs while the editor is hidden\", sceneName() !== start, start + \" -> \" + sceneName());",
  "      // The OTHER direction -- toggling the panel mid-run and watching the cycle stop --",
  "      // is deliberately NOT asserted here. Verified against a build with the gate deleted,",
  "      // it passes either way: after a mid-run state change headless renders only two frames",
  "      // in twenty virtual seconds, so nothing would have switched regardless. case-open",
  "      // covers the claim from the other end and DOES go red without the gate.",
  "      console.log(\"DONE \" + CASE + \" fails=\" + fails);",
  "    }, 6000);",
  "    return;",
  "  }",
  "",
  "  // case-open: the panel is up, so nothing may switch. Then hide it and it must.",
  "  ok(\"a stored panelOpen:true stays open\", !hidden());",
  "  ok(\"the paused note is in the Scene box\", !!document.querySelector(\"#panel .cycle-note\"));",
  "  ok(\"the cycle checkbox is still ticked\", document.getElementById(\"cycle\").checked);",
  "",
  "  var held = sceneName();",
  "  setTimeout(function () {",
  "    ok(\"no switch while the editor is open\", sceneName() === held, held + \" -> \" + sceneName());",
  "    ok(\"the stored preference was not rewritten\", document.getElementById(\"cycle\").checked);",
  "",
  "    // ---- the three layer tabs, while the panel is still up ----",
  "    // Effect / Filters / Palette over the three runs the block always had. ONE open tab",
  "    // for every block (a tab is a way of looking at a layer, and switching layers must",
  "    // not also switch what you are looking at), transient, and it REPLACED the palette",
  "    // fold -- a tab is a fold with a name.",
  "    var tabs = document.querySelectorAll(\"[data-k=tab-btn-fx]\");",
  "    var panes = function(t){ return [].slice.call(document.querySelectorAll(\"[data-k=tab-\" + t + \"]\")); };",
  "    ok(\"every block has a tab strip\", tabs.length > 1, tabs.length + \" strips\");",
  "    ok(\"Effect is open and the other two hidden at rest\",",
  "       panes(\"fx\").every(function(n){ return !n.hidden; }) && panes(\"flt\").every(function(n){ return n.hidden; }) && panes(\"pal\").every(function(n){ return n.hidden; }));",
  "    // Unfold the first row so a tab is actually clickable, then click Palette on it.",
  "    var chev = document.querySelector(\"#panel .lyr b.lyr-chev\"); if (chev) chev.click();",
  "    var palBtn = [].slice.call(document.querySelectorAll(\"[data-k=tab-btn-pal]\")).filter(function(n){ return n.offsetParent !== null; })[0];",
  "    ok(\"a Palette tab is on screen once a row is unfolded\", !!palBtn);",
  "    if (palBtn) {",
  "      palBtn.click();",
  "      ok(\"clicking Palette opens it in EVERY block\", panes(\"pal\").every(function(n){ return !n.hidden; }));",
  "      ok(\"...and closes Effect everywhere\", panes(\"fx\").every(function(n){ return n.hidden; }));",
  "      ok(\"the Palette tab holds the swatches, cycle AND banding\",",
  "         !!panes(\"pal\")[0].querySelector(\"[data-k=palswatches]\") && !!panes(\"pal\")[0].querySelector(\"[data-k=palctl]\") && !!panes(\"pal\")[0].querySelector(\"[data-k=bandctl]\"));",
  "      ok(\"the Filters tab holds the chain\", !!panes(\"flt\")[0].querySelector(\"[data-k=filterlist]\"));",
  "      ok(\"the Effect tab holds the sliders and Reset\", !!panes(\"fx\")[0].querySelector(\"[data-k=fxctl]\") && !!panes(\"fx\")[0].querySelector(\"[data-k=reset]\"));",
  "      ok(\"the open tab is marked\", palBtn.classList.contains(\"on\") && palBtn.getAttribute(\"aria-selected\") === \"true\");",
  "      // Selecting ANOTHER layer must not change the tab.",
  "      var rows = [].slice.call(document.querySelectorAll(\"#panel .lyr\")).filter(function(r){ return r.offsetParent !== null; });",
  "      if (rows[1]) { rows[1].dispatchEvent(new PointerEvent(\"pointerdown\", { bubbles: true })); }",
  "      ok(\"selecting another layer keeps the Palette tab open\", panes(\"pal\").every(function(n){ return !n.hidden; }));",
  "      var fxBtn = [].slice.call(document.querySelectorAll(\"[data-k=tab-btn-fx]\")).filter(function(n){ return n.offsetParent !== null; })[0];",
  "      if (fxBtn) fxBtn.click();",
  "      ok(\"Effect comes back\", panes(\"fx\").every(function(n){ return !n.hidden; }));",
  "    }",
  "",
  "    // The resume direction is asserted in case-closed, from a state where the loop is",
  "    // demonstrably running -- headless virtual time renders too few frames after a",
  "    // mid-run pause for a restart to be measurable here.",
  "    pressM();",
  "    ok(\"M hides the panel again\", hidden());",
  "    console.log(\"DONE \" + CASE + \" fails=\" + fails);",
  "  }, 6000);",
  "})();"
].join(NL);

function build(name, seedJson) {
  let s = app.replace("<head>", "<head>" + NL + "<script>" + SEED_JS.replace("__SEED__", seedJson) + "<" + "/script>");
  s = s.replace("</body>", "<script>" + ASSERT_JS.replace("__CASE__", JSON.stringify(name)) + "<" + "/script>" + NL + "</body>");
  if (s === app) throw new Error("injection failed for " + name);
  const f = path.join(outDir, name + ".html");
  fs.writeFileSync(f, s);
  console.log("wrote " + f);
}

// A returning user with the panel OPEN, auto-cycle on, a 1s TTL and transitions pinned off
// (a half-drawn blend is the documented screenshot trap and would also blur the readback).
build("case-open", JSON.stringify({ panelOpen: true, cycle: true, ttl: [1, 1], tdur: [0, 0] }));
// A returning user who had it closed: stays closed, and the cycler actually runs.
build("case-closed", JSON.stringify({ panelOpen: false, cycle: true, ttl: [1, 1], tdur: [0, 0] }));
// FIRST VISIT -- nothing stored at all. Must start hidden, or the show never runs.
build("case-first", "null");

const abs = path.resolve(outDir).split(path.sep).join("/");
console.log(NL + "run each with:");
for (const c of ["case-first", "case-closed", "case-open"]) {
  console.log('  msedge --headless=new --disable-extensions --enable-logging=stderr --v=0'
    + ' --virtual-time-budget=60000 --user-data-dir="' + abs + '/ud-' + c + '"'
    + ' "file:///' + abs + '/' + c + '.html" 2>&1 | grep -oE ' + Q + '"(PASS|FAIL|DONE)[^"]*"' + Q);
}
