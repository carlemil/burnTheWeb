// Headless probe for the GL heat-tick feedback chain.
// Slices the REAL glBeginHeat out of index.html and runs it against a recording
// stub gl, so this tests the shipped code, not a copy of it.
//
// Why this exists: a headless browser has no usable WebGL, so the pixel harness can
// only ever exercise the Canvas2D path. The GL ping-pong parity — `pendingDst` must
// name the buffer the LAST feedback pass wrote — is therefore untestable on screen,
// and it only misbehaves when TWO feedback filters are ticked at once (with one pass
// the right and wrong answers coincide). That is exactly the kind of bug that ships.
//
// It slices by source markers, so keep them: `function glBeginHeat(` … `function glBlitPoints(`,
// and `function glLayerBeginHeat(` … `function renderLayerHeat(` for the per-layer twin.
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

// The heat textures/FBOs are opaque handles here; we only care which INDEX each call
// touched, so the stubs are tagged objects and `gl` records the call order.
const stubs = `
  let fw = 8, fh = 8, curHeat = 0, pendingDst = 0, chainIds = [];
  const log = [];
  const glTex = { heat: [{ tex: 0 }, { tex: 1 }] };
  const glFbo = { heat: [{ fbo: 0 }, { fbo: 1 }] };
  let bound = -1;
  function bindFbo(f) { bound = f.fbo; log.push("bind:" + f.fbo); }
  const gl = { BLEND: 1, COLOR_BUFFER_BIT: 2, disable() {}, clearColor() {},
               clear() { log.push("clear:" + bound); } };
  // Each stub filter records (source texture -> currently bound FBO).
  function activeFilters() {
    return chainIds.map(id => ({
      id, stage: "feedback",
      glFeedback: srcTex => log.push(id + ":" + srcTex.tex + "->" + bound),
    }));
  }
`;
const code = stubs + cut("  function glBeginHeat(", "  function glBlitPoints(") +
  "\nreturn { run(ids, start) { chainIds = ids; curHeat = start; log.length = 0;" +
  "  glBeginHeat(); return { log: log.slice(), pendingDst, bound }; } };";
const H = new Function(code)();

let pass = 0, fail = 0;
const ok = (cond, name, detail) => {
  (cond ? pass++ : fail++);
  console.log((cond ? "PASS  " : "FAIL  ") + name + (detail ? "  [" + detail + "]" : ""));
};

// --- 1. empty chain clears, and never reuses the live buffer -------------------
for (const start of [0, 1]) {
  const r = H.run([], start);
  ok(r.pendingDst === 1 - start, "empty chain targets the other buffer (curHeat=" + start + ")",
     "pendingDst " + r.pendingDst);
  ok(r.log.join(",") === "bind:" + (1 - start) + ",clear:" + (1 - start),
     "empty chain binds then clears, nothing else (curHeat=" + start + ")", r.log.join(","));
}

// --- 2. pendingDst names where the LAST pass landed ---------------------------
// This is the assertion the whole file exists for. With N passes ping-ponging from
// curHeat, the result sits in (curHeat + N) % 2 — NOT a fixed 1 - curHeat.
for (const start of [0, 1]) {
  for (let n = 1; n <= 4; n++) {
    const ids = Array.from({ length: n }, (_, i) => "f" + i);
    const r = H.run(ids, start);
    const expect = (start + n) % 2;
    ok(r.pendingDst === expect,
       n + " feedback pass(es) from curHeat=" + start + " land in buffer " + expect,
       "pendingDst " + r.pendingDst + " | " + r.log.join(","));
  }
}

// --- 3. two passes return to the ORIGINAL buffer -------------------------------
// The case a `pendingDst = 1 - curHeat` bug gets wrong, and the only one a user can
// hit today (Fire + Fade both ticked).
{
  const r = H.run(["fire", "fade"], 0);
  ok(r.pendingDst === 0, "Fire+Fade from buffer 0 ends back in buffer 0", "pendingDst " + r.pendingDst);
  ok(r.log.join(",") === "bind:1,fire:0->1,bind:0,fade:1->0",
     "...having ping-ponged 0->1 then 1->0", r.log.join(","));
}

// --- 4. a pass never samples the texture it is writing ------------------------
// Sampling the current colour attachment is undefined behaviour in WebGL.
for (const n of [1, 2, 3, 4]) {
  const ids = Array.from({ length: n }, (_, i) => "f" + i);
  const r = H.run(ids, 0);
  const bad = r.log.filter(l => l.includes("->")).filter(l => {
    const [, io] = l.split(":"); const [i, o] = io.split("->"); return i === o;
  });
  ok(!bad.length, n + " pass(es): no pass samples its own render target", bad.join(",") || "clean");
}

// --- 5. the final destination FBO is left bound for the effect to draw into ----
for (const n of [0, 1, 2, 3]) {
  const ids = Array.from({ length: n }, (_, i) => "f" + i);
  const r = H.run(ids, 0);
  ok(r.bound === r.pendingDst, n + " pass(es): the pendingDst FBO is still bound on exit",
     "bound " + r.bound + " vs pendingDst " + r.pendingDst);
}

// --- 6. only feedback filters with a glFeedback pass are run -------------------
// (glBeginHeat filters the list itself; a post filter must never reach the heat tick.)
{
  const marker = "stage === \"feedback\"";
  ok(cut("  function glBeginHeat(", "  function glBlitPoints(").includes(marker),
     "glBeginHeat selects on stage === feedback, not on a hardcoded filter id");
  ok(cut("  function glBeginHeat(", "  function glBlitPoints(").includes("f.glFeedback"),
     "...and dispatches through the filter's own glFeedback hook");
}

// --- 7. glLayerBeginHeat: the per-LAYER twin, same parity on a private pair ----
// The multi-layer colour path gives each stacked effect its own heat pair. glLayerBeginHeat
// is glBeginHeat re-expressed as a pure function of (slot, src, chain) that RETURNS the
// buffer the last pass wrote (rather than setting the module pendingDst), so the caller can
// stamp/inject into it. It has the identical two-filter parity bug class, invisible to a
// screenshot the same way — so pin it the same way. glBeginHeat itself stays untouched
// (sections 1–6 above); this just checks the copy hasn't drifted from it.
const layerStubs = `
  let fw = 8, fh = 8;
  const log = [];
  const glTex = { heatL: [[{ tex: 0 }, { tex: 1 }]] };
  const glFbo = { heatL: [[{ fbo: 0 }, { fbo: 1 }]] };
  let bound = -1;
  function bindFbo(f) { bound = f.fbo; log.push("bind:" + f.fbo); }
  const gl = { BLEND: 1, COLOR_BUFFER_BIT: 2, disable() {}, clearColor() {},
               clear() { log.push("clear:" + bound); } };
`;
const layerCode = layerStubs + cut("  function glLayerBeginHeat(", "  function renderLayerHeat(") +
  "\nreturn { run(n, start) { log.length = 0;" +
  "  const chain = Array.from({length: n}, (_, i) => ({ glFeedback: src => log.push('f' + i + ':' + src.tex + '->' + bound) }));" +
  "  const ret = glLayerBeginHeat(0, start, chain); return { ret, log: log.slice(), bound }; } };";
const HL = new Function(layerCode)();

for (const start of [0, 1]) {
  const r = HL.run(0, start);
  ok(r.ret === 1 - start && r.log.join(",") === "bind:" + (1 - start) + ",clear:" + (1 - start),
     "layer empty chain clears the other buffer and returns it (src=" + start + ")",
     "ret " + r.ret + " | " + r.log.join(","));
}
for (const start of [0, 1]) {
  for (let n = 1; n <= 4; n++) {
    const r = HL.run(n, start);
    const expect = (start + n) % 2;
    ok(r.ret === expect, "layer " + n + " pass(es) from src=" + start + " return buffer " + expect,
       "ret " + r.ret + " | " + r.log.join(","));
    const self = r.log.filter(l => l.includes("->")).filter(l => { const [i, o] = l.split(":")[1].split("->"); return i === o; });
    ok(!self.length, "layer " + n + " pass(es): none samples its own render target (src=" + start + ")", self.join(",") || "clean");
    ok(r.bound === r.ret, "layer " + n + " pass(es): the returned FBO is still bound on exit (src=" + start + ")",
       "bound " + r.bound + " vs ret " + r.ret);
  }
}

console.log("\n" + (fail ? fail + " FAILED, " : "") + "all " + pass + " passed");
process.exit(fail ? 1 : 0);
