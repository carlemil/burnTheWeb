// Headless probe for the GALAXY's two sign-and-stability properties, both of which are
// invisible in a still frame and both of which shipped wrong.
//
//   * The arms must TRAIL. Going outward along an arm the angle has to DECREASE while the
//     disc turns the other way, so the tips lag the rotation — which is what every real
//     spiral galaxy does. It shipped with the log term's sign the other way round, so the
//     arms led and the whole thing read as spinning backwards. A screenshot cannot tell you
//     this; you need two frames, or this.
//   * The arms must STAY arms. A 1/r rotation curve is what the stars really do and it winds
//     the spiral out of existence within a minute. Capping the centre-to-rim ratio at 2:1
//     was claimed to fix it and did not — both terms still grew with the clock. The pattern
//     now rotates rigidly (density-wave style) with a bounded shear on top.
//
// Measuring the second one is fiddly and two earlier versions of this file got it wrong by
// passing the very bug they were written for, so: NOT a swept angle. Each star carries a
// ±5% radius jitter, and once the spiral is steep that smears a radius bin's stars across a
// whole arm spacing — so a sweep degenerates into noise rather than into a big number, and
// any fold-and-compare aliases the moment the winding passes half an arm. What is measured
// instead is ARM SHARPNESS: the circular concentration R of the folded angle inside a radius
// bin. Near 1 the stars sit on a line and there is an arm; near 0 they are spread evenly
// round the ring and the arm has been wound into a uniform disc. That IS the failure.
//
// Slices the real galaxyStamp out of the built file, so it tests the shipped code.
// Usage: node tools/galaxyprobe.js dev-index.html
// Markers: `function galaxyStamp(` … `// ---- Harmonograph`.
const fs = require("fs");
const html = fs.readFileSync(process.argv[2] || "dev-index.html", "utf8");
const s0 = html.indexOf("<script>"), s1 = html.indexOf("</script>", s0);
const src = html.slice(s0 + 8, s1);
const a = src.indexOf("function galaxyStamp(");
const b = src.indexOf("// ---- Harmonograph", a);
if (a < 0 || b < 0) throw new Error("could not slice galaxyStamp");

// Stub just enough for it to run, and capture the plotted points with their radius.
const pts = [];
const code = `
  let gxArms = 2, gxTwist = 0.55, gxSpin = 0.5, gxCore = 0, gxScatter = 0, gxTime = 0;
  const GX_HEAT = 26;
  let rngState = 0; const SEED = 12345;
  const cfg = { burn: 120 };
  function rnd() {
    rngState |= 0; rngState = (rngState + 0x6D2B79F5) | 0;
    let z = rngState; z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  }
  const out = [];
  function plot(x, y) { out.push([x, y]); }
  ${src.slice(a, b)}
  return { galaxyStamp, out, setT: v => gxTime = v, getT: () => gxTime };
`;
const G = new Function(code)();

let pass = 0, fail = 0;
const ok = (c, n, d) => { c ? pass++ : fail++; console.log((c ? "PASS  " : "FAIL  ") + n + (d ? "  [" + d + "]" : "")); };

// One frame at a fixed clock; centre the box on the origin so atan2 is the star's angle.
function frame(t) {
  G.out.length = 0;
  G.setT(t);
  // galaxyStamp advances the clock itself, so set it back to what we asked for.
  G.galaxyStamp(-1000, 1000, -1000, 1000, 4000);
  G.setT(t);
  return G.out.map(([x, y]) => ({ r: Math.hypot(x, y), th: Math.atan2(y, x) }));
}

// --- 1. the arms TRAIL: angle falls as radius rises, along one arm ---------------
// Unwrap by comparing binned means of a monotone-in-r sample of ONE arm. The arms are
// armStep apart, so fold every star into arm 0 and unwrap the spiral by hand.
{
  const f = frame(0);
  // dθ/d(log r) is the spiral's slope and is the same for every arm; recover it by
  // regressing the folded angle against log r over a radius range short enough not to wrap.
  const sel = f.filter(p => p.r > 300 && p.r < 620);
  const armStep = Math.PI;                       // 2 arms
  const fold = th => { let v = th % armStep; if (v < 0) v += armStep; return v; };
  // Take the median folded angle in two radius bins and compare.
  const med = arr => { const s = arr.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
  const lo = sel.filter(p => p.r < 420).map(p => fold(p.th));
  const hi = sel.filter(p => p.r >= 480).map(p => fold(p.th));
  ok(lo.length > 50 && hi.length > 50, "enough stars in both radius bins", lo.length + " / " + hi.length);
  // Unwrapped difference in (-armStep/2, armStep/2].
  let d = med(hi) - med(lo);
  while (d > armStep / 2) d -= armStep;
  while (d <= -armStep / 2) d += armStep;
  ok(d < 0, "the arms TRAIL: angle decreases outward", "d(theta) = " + d.toFixed(3) + " rad");
}

// --- 2. the disc turns FORWARD (+theta) for positive Spin -----------------------
{
  const t0 = frame(0), t1 = frame(0.25);
  // Same PRNG sequence, so star i at t0 and t1 is the same star: compare directly.
  let sum = 0, cnt = 0;
  for (let i = 0; i < Math.min(t0.length, t1.length); i++) {
    if (t0[i].r < 200) continue;
    let d = t1[i].th - t0[i].th;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    sum += d; cnt++;
  }
  const mean = sum / cnt;
  ok(mean > 0, "the disc rotates FORWARD for positive Spin", "mean d(theta) = " + mean.toFixed(4));
}

// --- 3. the arms do NOT wind up over time ---------------------------------------
// The point of the density-wave rewrite. Measured as the TOTAL UNWRAPPED sweep of the arm
// between two radii: bin finely and accumulate step by step, because comparing two folded
// angles directly aliases the moment the winding passes half an arm — which is exactly how
// the first version of this test passed the very bug it was written for.
{
  const armStep = Math.PI;                       // 2 arms
  const fold = th => { let v = th % armStep; if (v < 0) v += armStep; return v; };
  const med = arr => { const s = arr.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
  // Measured as ARM SHARPNESS, not as a swept angle. Unwrapping cannot survive heavy
  // winding here: each star carries a +/-5% radius jitter, and once the spiral is steep that
  // smears a bin's stars across the whole arm spacing, so a sweep measurement degenerates
  // into noise rather than into a big number — which is how the first two versions of this
  // test passed the very bug they were written for.
  //
  // Sharpness is the circular concentration R of the folded angle within a radius bin: near
  // 1 the stars sit on a line and there is an arm; near 0 they are spread evenly round the
  // ring and the "arm" has been wound into a uniform disc. That IS the failure, measured
  // directly.
  const sharpness = t => {
    const f = frame(t);
    const R0 = 280, R1 = 560, NB = 14, bw = (R1 - R0) / NB;
    let sum = 0, used = 0;
    for (let i = 0; i < NB; i++) {
      const lo = R0 + i * bw;
      const bin = f.filter(p => p.r >= lo && p.r < lo + bw);
      if (bin.length < 20) continue;
      let sx = 0, sy = 0;
      for (const p of bin) {
        const a = fold(p.th) / armStep * 2 * Math.PI;   // one arm spacing -> a full circle
        sx += Math.cos(a); sy += Math.sin(a);
      }
      sum += Math.hypot(sx, sy) / bin.length; used++;
    }
    return used ? sum / used : 0;
  };
  const h0 = sharpness(0), h1 = sharpness(60);   // 60 = one minute at Spin 1
  ok(h0 > 0.75, "the arms are sharp to begin with", "R = " + h0.toFixed(3));
  ok(h1 > 0.6, "...and are still arms after a minute of running", "R = " + h1.toFixed(3));
}

console.log("\n" + (fail ? fail + " FAILED, " + pass + " passed" : "all " + pass + " passed"));
process.exit(fail ? 1 : 0);
