// Headless probe for the post-FX filter registry.
// Slices the REAL registry + its helpers out of index.html and exercises them on
// stub state — so this tests the shipped code, not a copy of it.
// Usage: node tools/filterprobe.js index.html
//
// It slices by source markers, so keep them: `// ---- FILTERS: stackable post-FX`
// … `function initStates(`, and `function presetExtra(` … `function initExtras(`.
const fs = require("fs");
const html = fs.readFileSync(process.argv[2] || "index.html", "utf8");
const s0 = html.indexOf("<script>"), s1 = html.indexOf("</script>", s0);
if (s0 < 0 || s1 < 0) throw new Error("probe: no inline <script> found");
const src = html.slice(s0 + 8, s1);

const cut = (from, to) => {
  const a = src.indexOf(from), b = src.indexOf(to);
  if (a < 0 || b < 0 || b < a) throw new Error("probe: could not slice " + from + " .. " + to);
  return src.slice(a, b);
};

// The registry block references drawing globals only inside its gl/cpu callbacks,
// which we never invoke here — stub what the top level touches.
const stubs = `
  let useGL = true, curHeat = 0, fw = 8, fh = 8, cfg = { decay: 129 }, fire = new Uint8Array(0);
  let bloomAmt = 0.35, fadeKeep = 0.94, pixelBlock = 6, softenAmt = -0.6, softenRad = 1.5,
      edgeAmt = 0.7, posterLevels = 5, mirrorMode = 1;
  let activeIds = new Set(["fire", "bloom"]);
  function filterOn(id) { return activeIds.has(id); }
  const gl = new Proxy({}, { get: () => () => {} });
  const glProg = new Proxy({}, { get: () => ({ p: null, u: {} }) });
  const glTex = { heat: [null, null], post: [null, null], native: null };
  function bindTexUnit() {} function drawQuad() {} function postPass() {} function el() { return null; }
  function screenPass() {} function glWarpFeedback() {} function heatWarpCPU() {} function heatDiffuseCPU() {}
  let echoDist = 2, echoAng = 90, echoKeep = 0.94, zfbScale = 1.02, zfbKeep = 0.94,
      swirlSpin = 2, swirlKeep = 0.94, diffRad = 1, diffKeep = 0.97, postTime = 0;
  let twistAmt = 1.2, wedgeSeg = 6, wedgeRot = 0, glitchAmt = 0.05, glitchRows = 8,
      halfDot = 4, halfAmt = 0.8, threshLevel = 0.5, threshAmt = 0.8, chromaAmt = 1;
  let barrelAmt = 0.15, scanAmt = 0.35, scanCount = 240, vigAmt = 0.4, grainAmt = 0.08;
  function buildFilterUI() {}   // DOM-only; the registry calls it right after defining FILTERS
  const EFFECTS = [
    { id: "sirpinfyer", extras: {}, defaults: { points: 3850 } },                 // point effect: no draw hook
    { id: "attractor",  extras: {}, defaults: {}, stamp: () => {} },              // also a point effect
    { id: "plasma",     extras: {}, defaults: {}, draw: () => {} },               // shader effect
    { id: "julia",      extras: {}, defaults: { rise: [77, 77] }, draw: () => {} },// names a filter key itself
  ];
`;
const code = stubs +
  cut("  // ---- FILTERS: stackable post-FX applied after the effect renders", "  function presetState(") +
  cut("  function presetState(", "  function initStates(") +
  cut("  function presetExtra(", "  function initExtras(") +
  "\nreturn { FILTERS, FILTER_BY_ID, FILTER_DEFAULTS, filtersOk, activeFilters, hasFeedback," +
  "  presetState, presetFilters, mergeExtra, presetExtra," +
  "  setActive(ids) { activeIds = new Set(ids); }, getActive() { return activeIds; } };";
const F = new Function(code)();

let pass = 0, fail = 0;
const ok = (cond, name, detail) => {
  (cond ? pass++ : fail++);
  console.log((cond ? "PASS  " : "FAIL  ") + name + (detail ? "  [" + detail + "]" : ""));
};
const ids = F.FILTERS.map(f => f.id);

// --- 1. registry shape --------------------------------------------------------
ok(ids.length >= 8, "at least 8 filters registered", ids.join(","));
ok(new Set(ids).size === ids.length, "no duplicate filter ids");
ok(F.FILTERS.every(f => ["feedback", "post", "screen"].indexOf(f.stage) >= 0),
   "every filter declares a known stage");
ok(F.FILTERS.every(f => Array.isArray(f.params) && f.params.length >= 0), "every filter declares params");
ok(F.FILTERS.every(f => f.defaults && Object.keys(f.defaults).length), "every filter ships defaults");
ok(F.FILTERS.every(f => f.params.every(k => k in f.defaults)),
   "every param has a default (else presetState can't seed it)");
// Bloom is the composite strength, not a chain pass; everything else post needs one.
ok(F.FILTERS.filter(f => f.stage === "post" && f.id !== "bloom").every(f => typeof f.gl === "function"),
   "post filters (bar Bloom) have a gl pass");
ok(F.FILTERS.filter(f => f.stage === "screen").every(f => typeof f.gl === "function"),
   "screen filters have a gl pass");
// A screen pass runs after the composite, which the Canvas2D path never performs.
ok(F.FILTERS.filter(f => f.stage === "screen").every(f => f.cpuOk === false),
   "screen filters are all marked GPU-only");
ok(F.FILTERS.filter(f => f.stage === "feedback").every(f => typeof f.glFeedback === "function"),
   "feedback filters have a glFeedback pass");

// --- 2. order is registry order, never stored order ---------------------------
{
  const back = ids.slice().reverse();
  const set = F.filtersOk(back);
  const applied = F.FILTERS.filter(f => set.has(f.id)).map(f => f.id);
  ok(JSON.stringify(applied) === JSON.stringify(ids),
     "a reversed stored list still applies in registry order");
  // The three stages must appear in pipeline order: feedback writes the heat the next
  // frame starts from, post repaints the image, screen sits on the finished composite.
  const stages = F.FILTERS.map(f => f.stage);
  const firstPost = stages.indexOf("post"), lastFeedback = stages.lastIndexOf("feedback");
  const firstScreen = stages.indexOf("screen"), lastPost = stages.lastIndexOf("post");
  ok(lastFeedback < firstPost, "all feedback filters precede all post filters",
     "lastFeedback " + lastFeedback + " < firstPost " + firstPost);
  ok(firstScreen < 0 || lastPost < firstScreen, "all post filters precede all screen filters",
     "lastPost " + lastPost + " < firstScreen " + firstScreen);
  // Bloom is the composite, so it closes the post stage — the screen filters that
  // follow it in the registry run after that composite, not inside the chain.
  ok(ids[lastPost] === "bloom", "Bloom is the last post filter (it is the composite)");
}

// --- 3. filtersOk tolerates junk ---------------------------------------------
ok(F.filtersOk(null) === null, "null list rejected (⇒ caller uses the descriptor default)");
ok(F.filtersOk("fire") === null, "a non-array is rejected");
ok(F.filtersOk([]).size === 0, "an empty list is honoured (all filters off)");
{
  const s = F.filtersOk(["fire", "nope", "fire", 7, null, "bloom"]);
  ok(s.size === 2 && s.has("fire") && s.has("bloom"),
     "unknown/duplicate/non-string ids dropped", [...s].join(","));
}

// --- 4. defaults preserve today's look ---------------------------------------
ok(JSON.stringify(F.presetFilters(0)) === '["fire","bloom"]', "point effect defaults to fire+bloom");
ok(JSON.stringify(F.presetFilters(1)) === '["fire","bloom"]',
   "an effect with `stamp` but no `draw` counts as a point effect");
ok(JSON.stringify(F.presetFilters(2)) === '["bloom"]', "shader effect defaults to bloom only");
ok(F.FILTERS.every(f => f.id === "bloom" || F.presetFilters(2).indexOf(f.id) < 0),
   "no other filter is on by default for a shader effect");

// --- 5. mergeExtra rescues pre-filter presets --------------------------------
{
  const old = { palette: "3", morph: true, showBox: true, randSeed: false };   // no `filters` key
  const m = F.mergeExtra(0, old);
  ok(JSON.stringify(m.filters) === '["fire","bloom"]',
     "a preset saved before filters gets the descriptor default, not an empty chain");
  ok(m.palette === "3" && m.randSeed === false, "...while its other extras survive");
  const m2 = F.mergeExtra(2, { filters: ["bloom", "fire"] });
  ok(JSON.stringify(m2.filters) === '["fire","bloom"]', "a stored list is re-sorted into registry order");
  // Only a MISSING key falls back to the descriptor. An empty list is a real
  // choice — "I turned everything off" — and must survive a save/load round trip,
  // or a no-filter scene would be impossible to keep.
  const m4 = F.mergeExtra(2, { filters: [] });
  ok(JSON.stringify(m4.filters) === "[]", "an empty stored list is honoured, not overridden");
  const m3 = F.mergeExtra(2, { filters: ["ghost"] });
  ok(JSON.stringify(m3.filters) === "[]",
     "a list naming only retired filters ends up empty (their choice is gone, not reset)");
  ok(JSON.stringify(F.mergeExtra(2, {}).filters) === '["bloom"]',
     "...but a missing key still falls back to the descriptor default");
}

// --- 6. presetState seeds every filter's params on every effect ---------------
{
  const st = F.presetState(2);                       // a shader effect that names none of them
  const missing = Object.keys(F.FILTER_DEFAULTS).filter(k => !(k in st));
  ok(!missing.length, "every filter param is seeded on an effect that never mentions it",
     missing.length ? "missing " + missing.join(",") : Object.keys(F.FILTER_DEFAULTS).join(","));
  ok(Array.isArray(st.rise) && st.rise[0] === 130, "Fire's Flame rise is seeded from the registry");
  const st3 = F.presetState(3);                      // this one sets `rise` itself
  ok(st3.rise[0] === 77, "an effect that names a filter key still wins", JSON.stringify(st3.rise));
  // seeded arrays must be copies, or two effects would share one array
  const a = F.presetState(2), b = F.presetState(2);
  a.rise[0] = 999;
  ok(b.rise[0] !== 999, "seeded params are per-effect copies, not shared references");
}

// --- 7. stage helpers ---------------------------------------------------------
{
  F.setActive(["bloom"]);
  ok(!F.hasFeedback(), "bloom alone is not feedback (so glBeginHeat clears)");
  F.setActive(["fire"]);
  ok(F.hasFeedback(), "fire is feedback");
  F.setActive(["fade"]);
  ok(F.hasFeedback(), "fade is feedback too");
  F.setActive(ids);
  ok(F.activeFilters().length === ids.length, "activeFilters returns them all when all are on");
  F.setActive([]);
  ok(F.activeFilters().length === 0 && !F.hasFeedback(), "nothing on ⇒ no chain at all");
}

console.log("\n" + (fail ? fail + " FAILED, " : "") + "all " + pass + " passed");
process.exit(fail ? 1 : 0);
