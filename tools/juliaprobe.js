// Headless probe for the cardioid seed orbit shared by AnimeJulia, Burning Ship
// and Multibrot. Slices the REAL seed source out of index.html (the constants,
// reseedJulia, juliaSeedAt, juliaSeed) and drives it on a fake clock — so this
// exercises the shipped code, not a copy of it.
// Usage: node tools/juliaprobe.js index.html
//
// It slices by source markers, so keep them: `const RPM` … `function julia(`.
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
const code =
  "let randSeed = false, zoom = 1, fw = 100, fh = 100;\n" +
  cut("const RPM", "function julia(") +
  "\nreturn { juliaSeed, juliaSeedAt, reseedJulia," +
  "  get outer() { return juliaOuter }, set outer(v) { juliaOuter = v }," +
  "  get inner() { return juliaInner }, set inner(v) { juliaInner = v }," +
  "  set innerR(v) { juliaInnerR = v }, get innerR() { return juliaInnerR }," +
  "  set outerR(v) { juliaOuterR = v }," +
  "  set rpm(v) { juliaBigRpm = v }, get rpm() { return juliaBigRpm }," +
  "  set ratio(v) { juliaRatio = v }, get ratio() { return juliaRatio }," +
  "  set phase(v) { juliaPhase = v }, set offX(v) { juliaOffX = v }," +
  "  RPM, JULIA_MARGIN, JULIA_RATIO_DEFAULT };";
const J = new Function(code)();

let pass = 0, fail = 0;
const ok = (cond, name, detail) => {
  (cond ? pass++ : fail++);
  console.log((cond ? "PASS  " : "FAIL  ") + name + (detail ? "  [" + detail + "]" : ""));
};
const near = (a, b, eps) => Math.abs(a - b) <= eps;
// the bare scaled cardioid the seed is supposed to ride, straight from the formula
const rim = (th, s, offX) => [
  (0.5 * Math.cos(th) - 0.25 * Math.cos(2 * th)) * s + offX,
  (0.5 * Math.sin(th) - 0.25 * Math.sin(2 * th)) * s,
];
const reset = () => {
  J.outer = 0; J.inner = 0; J.phase = 0; J.offX = 0;
  J.innerR = 0.05; J.outerR = 1.05; J.rpm = 0.5; J.ratio = 12;
};

// --- 1. the seed is the rim point PLUS the riding circle -----------------------
// The whole point of the small circle is variance: c must sit exactly innerR away
// from the cardioid rim, in the direction of the inner phase.
reset();
{
  let worst = 0, worstAng = 0;
  for (let i = 0; i < 500; i++) {
    const outer = i * 0.137, inner = i * 1.911;
    const p = J.juliaSeedAt(outer, inner);
    const [bx, by] = rim(outer, (1 + J.JULIA_MARGIN) * 1.05, 0);
    worst = Math.max(worst, Math.hypot(p.bx - bx, p.by - by));                  // rim point itself
    worstAng = Math.max(worstAng, Math.abs(Math.hypot(p.cx - bx, p.cy - by) - J.innerR));
  }
  ok(worst < 1e-12, "rim point matches the cardioid formula", "err " + worst.toExponential(1));
  ok(worstAng < 1e-12, "seed rides exactly innerR off the rim", "err " + worstAng.toExponential(1));
}

// --- 2. the riding circle actually moves the seed ------------------------------
// Guards the reported symptom: "the inner radius doesn't look like it's in use".
reset();
{
  const a = J.juliaSeedAt(1.0, 0), b = J.juliaSeedAt(1.0, Math.PI);
  ok(near(Math.hypot(a.cx - b.cx, a.cy - b.cy), 2 * J.innerR, 1e-12),
     "opposite inner phases are a diameter apart", "d " + Math.hypot(a.cx - b.cx, a.cy - b.cy).toFixed(4));
  J.innerR = 0;
  const z = J.juliaSeedAt(1.0, 2.0);
  ok(near(z.cx, z.bx, 1e-12) && near(z.cy, z.by, 1e-12), "innerR 0 collapses the seed onto the rim");
}

// --- 3. both phases advance, inner at ratio x outer ----------------------------
reset();
{
  const dt = 1 / 60, o0 = J.outer, i0 = J.inner;
  J.juliaSeed(dt);
  const dOuter = J.outer - o0, dInner = J.inner - i0;
  ok(near(dOuter, dt * J.rpm * J.RPM, 1e-15), "outer advances rpm x RPM x dt");
  ok(near(dInner, dOuter * J.ratio, 1e-15), "inner advances ratio x outer", "ratio " + (dInner / dOuter).toFixed(2));
}

// --- 4. over one outer lap the seed makes `ratio` epicycles --------------------
// Counts how many times the seed crosses the rim curve outward — that is the
// visible "variance" the small circle is there to add.
reset();
{
  const laps = [];
  for (const ratio of [6, 12, 21.5]) {
    J.outer = 0; J.inner = 0; J.ratio = ratio;
    let prev = 0, cross = 0;
    const N = 20000;
    for (let i = 1; i <= N; i++) {
      const f = i / N, outer = f * Math.PI * 2, inner = f * Math.PI * 2 * ratio;
      const p = J.juliaSeedAt(outer, inner);
      const [bx, by] = rim(outer, (1 + J.JULIA_MARGIN) * 1.05, 0);
      // radial component of the offset: + when the seed is outside the rim
      const rad = ((p.cx - bx) * bx + (p.cy - by) * by);
      if (prev <= 0 && rad > 0) cross++;
      prev = rad;
    }
    laps.push(ratio + "->" + cross);
    ok(Math.abs(cross - Math.round(ratio)) <= 1, "ratio " + ratio + " gives ~" + Math.round(ratio) + " epicycles per lap", "got " + cross);
  }
}

// --- 5. a real frame sequence keeps moving (no frozen inner phase) -------------
reset();
{
  const pts = [];
  for (let i = 0; i < 240; i++) pts.push(J.juliaSeed(1 / 60));       // 4s at 60fps
  const [bx0, by0] = rim(J.outer, (1 + J.JULIA_MARGIN) * 1.05, 0);
  // spread of the seed *relative to the rim* — zero would mean a dead inner circle
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < 240; i++) {
    const p = J.juliaSeedAt(i * 0.01, i * 0.01 * J.ratio);
    const [bx, by] = rim(i * 0.01, (1 + J.JULIA_MARGIN) * 1.05, 0);
    const ang = Math.atan2(p.cy - by, p.cx - bx);
    mn = Math.min(mn, ang); mx = Math.max(mx, ang);
  }
  ok(mx - mn > 5, "inner phase sweeps the full circle over a few seconds", "span " + (mx - mn).toFixed(2) + " rad");
  ok(pts.some(p => p.cx !== pts[0].cx), "seed changes frame to frame");
}

// --- 6. offsets/scales apply to the whole orbit, not just the rim --------------
reset();
{
  J.offX = 0.3;
  const p = J.juliaSeedAt(0.7, 2.1);
  J.offX = 0;
  const q = J.juliaSeedAt(0.7, 2.1);
  ok(near(p.cx - q.cx, 0.3, 1e-12) && near(p.cy, q.cy, 1e-12), "X offset shifts the seed on the real axis only");
  J.outerR = 2;
  const big = J.juliaSeedAt(0.7, 2.1);
  ok(Math.hypot(big.cx - big.bx, big.cy - big.by) > 0, "riding circle survives an outer-radius change",
     "off-rim " + Math.hypot(big.cx - big.bx, big.cy - big.by).toFixed(4));
}

// --- 7. every cardioid effect advances the orbit exactly once per frame -------
// Regression guard: the CPU fallbacks used to call juliaSeed() again themselves,
// so on the Canvas2D path Burning Ship / Multibrot ran the orbit at double speed.
// Checked on the source, since the draw hooks need a GL context to run.
{
  const decl = id => {
    const i = src.indexOf('id: "' + id + '"');
    if (i < 0) throw new Error("probe: no descriptor for " + id);
    const j = src.indexOf("draw: dt =>", i);
    return src.slice(j, src.indexOf("\n", j));
  };
  for (const id of ["animejulia", "burningship", "multibrot"]) {
    const d = decl(id);
    const calls = (d.match(/juliaSeed\(/g) || []).length;
    ok(calls === 1, id + " advances the seed once per frame", calls + " juliaSeed() call(s) in draw");
  }
  for (const fn of ["function julia(", "function burningShip(", "function multibrot("]) {
    const i = src.indexOf(fn);
    const body = src.slice(i, i + 400);
    ok(!/juliaSeed\(/.test(body), fn.slice(9, -1) + "() takes the seed instead of re-advancing it");
  }
}

console.log("\n" + (fail ? fail + " FAILED, " : "") + "all " + pass + " passed");
process.exit(fail ? 1 : 0);
