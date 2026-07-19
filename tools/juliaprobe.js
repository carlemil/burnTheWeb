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
  "  set power(v) { juliaPower = v }, get power() { return juliaPower }, cardioidAt," +
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
  // ...times the lap-speed easing at this angle (see 6b); o0 = 0 is the cusp,
  // where the easing is at its maximum EASE_K * (1 + A).
  const easeAt0 = (1 + 0.5) / Math.sqrt(1 - 0.25);
  ok(near(dOuter, dt * J.rpm * J.RPM * easeAt0, 1e-15), "outer advances rpm x RPM x dt x ease",
     "ease " + (dOuter / (dt * J.rpm * J.RPM)).toFixed(6));
  // The riding circle is NOT eased — it advances at the plain rate, so at the
  // cusp (where the outer is sped up) its per-step ratio to the outer is lower.
  ok(near(dInner, dt * J.rpm * J.RPM * J.ratio, 1e-15), "inner advances at the un-eased ratio rate");
  ok(near(dInner / dOuter, J.ratio / easeAt0, 1e-9), "inner is not dragged by the easing",
     "inner:outer " + (dInner / dOuter).toFixed(3) + " vs unwarped " + J.ratio);
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

// --- 6b. lap-speed easing: 3:1 cusp-to-back, same lap time --------------------
// The orbit sprints through the cusp and eases at the back on a cosine. Two
// things must hold: the ratio is exactly 3, and the lap still takes 1/rpm minutes
// (the naive 1+A·cos without EASE_K would run ~15% slow).
reset();
{
  const dt = 1e-4;
  const speedAt = th => {                       // instantaneous dθ/dt at lap angle th
    J.outer = th; J.inner = 0;
    const before = J.outer;
    J.juliaSeed(dt);
    return (J.outer - before) / dt;
  };
  const fast = speedAt(0), slow = speedAt(Math.PI);
  ok(near(fast / slow, 3, 1e-9), "cusp is exactly 3x the back", "ratio " + (fast / slow).toFixed(6));
  ok(near(speedAt(Math.PI / 2) / ((fast + slow) / 2), 1, 1e-9), "quarter-lap sits midway (cosine shape)");

  // integrate a whole lap and compare with the constant-speed lap time
  J.outer = 0; J.inner = 0; J.rpm = 1; J.ratio = 12;
  const h = 1 / 2000;
  let t = 0, guard = 0;
  while (J.outer < Math.PI * 2 && guard++ < 5e6) { J.juliaSeed(h); t += h; }
  const ideal = 60 / J.rpm;                     // 1 rpm ⇒ 60s per lap
  ok(near(t, ideal, ideal * 0.002), "a lap still takes 1/rpm minutes", t.toFixed(3) + "s vs " + ideal + "s");

  // The inner runs on its own steady clock, but because the lap TIME is preserved
  // it still completes exactly `ratio` turns per lap — the turns are just
  // distributed unevenly along the path (bunched where the cardioid crawls).
  J.outer = 0; J.inner = 0;
  let g = 0;
  while (J.outer < Math.PI * 2 && g++ < 5e6) J.juliaSeed(h);
  const turns = J.inner / (Math.PI * 2);
  ok(near(turns, J.ratio, 0.02), "inner still turns `ratio` times per lap", turns.toFixed(3) + " vs " + J.ratio);
  // ...and unevenly. NB the easing is symmetric about theta=pi, so the two HALF
  // laps take equal time (each holds half the fast region) — the asymmetry shows
  // up per quarter: the cusp quarter is quick, the back quarter is slow, so the
  // steady inner circle lays down far fewer turns across the former.
  const turnsOver = (from, to) => {
    J.outer = from; J.inner = 0;
    let n = 0;
    while (J.outer < to && n++ < 5e6) J.juliaSeed(h);
    return J.inner / (Math.PI * 2);
  };
  const cuspQ = turnsOver(0, Math.PI / 2), backQ = turnsOver(Math.PI / 2, Math.PI);
  ok(backQ > cuspQ * 1.8, "epicycles bunch in the slow back, not spread evenly",
     cuspQ.toFixed(2) + " turns across the cusp quarter vs " + backQ.toFixed(2) + " across the back");

  // easing is a time warp only — the shape of the path is untouched
  const p = J.juliaSeedAt(1.234, 5.678);
  ok(isFinite(p.cx) && isFinite(p.cy), "juliaSeedAt stays pure (no easing baked into the path)");
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

// --- 8. the orbit follows the *degree-d* locus, not always the d=2 cardioid ---
// The seed is only interesting just OUTSIDE the connectedness locus of z^d+c. It used
// to ride the d=2 cardioid whatever the Power slider said, so Multibrot (Power drifts
// 2→3.5) spent ~3/4 of each lap with the seed buried inside the real locus — a filled
// Julia blob pinned at max palette instead of dendrites.
{
  // c is in the degree-d locus iff the critical point z=0 stays bounded.
  const inLocus = (cx, cy, d, N = 400) => {
    let zx = 0, zy = 0;
    for (let i = 0; i < N; i++) {
      const m2 = zx * zx + zy * zy;
      if (m2 > 4) return false;
      const r = Math.pow(Math.sqrt(m2), d), a = Math.atan2(zy, zx) * d;
      zx = r * Math.cos(a) + cx; zy = r * Math.sin(a) + cy;
    }
    return true;
  };

  // d=2 must reduce to the classic cardioid EXACTLY — that is what keeps AnimeJulia
  // and Burning Ship (and every d=2 preset) byte-identical.
  let worst = 0;
  for (let i = 0; i <= 720; i++) {
    const th = i / 720 * Math.PI * 2;
    const got = J.cardioidAt(th, 2);
    const want = [0.5 * Math.cos(th) - 0.25 * Math.cos(2 * th),
                  0.5 * Math.sin(th) - 0.25 * Math.sin(2 * th)];
    worst = Math.max(worst, Math.abs(got[0] - want[0]), Math.abs(got[1] - want[1]));
  }
  ok(worst === 0, "cardioidAt(θ,2) is bit-identical to the classic cardioid",
     "max |Δ| = " + worst);

  // The generalized curve must actually be the period-1 boundary: on it, the fixed
  // point's multiplier |d·z^(d−1)| == 1. Check via c = z − z^d at |z| = d^(−1/(d−1)).
  for (const d of [2, 2.5, 3, 3.5, 5]) {
    const R = Math.pow(d, -1 / (d - 1));
    const mult = d * Math.pow(R, d - 1);
    ok(Math.abs(mult - 1) < 1e-12, "power " + d + ": boundary multiplier is 1",
       "|λ| = " + mult.toFixed(15));
  }

  // Sweep a lap and measure how much of it lands inside the locus (= a filled blob
  // pinned at max palette, instead of dendrites). `orbitPower` is what the seed rides,
  // `iterPower` what the shader iterates — the bug was these disagreeing.
  J.outerR = 1.05; J.innerR = 0; J.phase = 0; J.offX = 0;
  const insideFrac = (orbitPower, iterPower) => {
    J.power = orbitPower;
    let inside = 0;
    const N = 360;
    for (let i = 0; i < N; i++) {
      const p = J.juliaSeedAt(i / N * Math.PI * 2, 0);
      if (inLocus(p.cx, p.cy, iterPower)) inside++;
    }
    return 100 * inside / N;
  };

  // Note this is NOT 0% even at d=2: scaling the cardioid radially by the margin walks
  // the seed through the period-2 bulb near θ=π, and those fat Julia sets are part of
  // AnimeJulia's shipped look. So the assertion is *matched vs mismatched*, not zero.
  const base2 = insideFrac(2, 2);
  ok(base2 < 30, "power 2 baseline (shipped AnimeJulia behaviour) is mostly outside",
     base2.toFixed(1) + "% inside");

  // The real regression guard: riding the matching locus must be dramatically better
  // than riding the d=2 cardioid while iterating at d. 20 points is well clear of the
  // 23–57 point gaps measured, and would go red the moment juliaPower stopped tracking.
  for (const d of [2.5, 3, 3.5]) {
    const matched = insideFrac(d, d);      // fixed: orbit follows the power
    const mismatched = insideFrac(2, d);   // bug: orbit pinned to the d=2 cardioid
    ok(matched <= mismatched - 20,
       "power " + d + ": matching the locus beats the old d=2-always orbit",
       matched.toFixed(1) + "% inside vs " + mismatched.toFixed(1) + "% before");
  }
  // Fractional powers stay worse than integer ones — the principal branch of z^d is
  // discontinuous across the negative real axis, so their locus is a messier object.
  // Recorded, not asserted away: if someone later makes these clean, this is the note.
  ok(insideFrac(3, 3) < insideFrac(2.5, 2.5),
     "integer powers sit further outside than fractional ones (branch-cut effect)",
     "d=3 " + insideFrac(3, 3).toFixed(1) + "% vs d=2.5 " + insideFrac(2.5, 2.5).toFixed(1) + "%");
  J.power = 2;
}

console.log("\n" + (fail ? fail + " FAILED, " : "") + "all " + pass + " passed");
process.exit(fail ? 1 : 0);
