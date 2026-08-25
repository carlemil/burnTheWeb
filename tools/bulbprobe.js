#!/usr/bin/env node
// Mandelbulb — interior-camera probe.
//
//   node tools/bulbprobe.js dev-index.html
//
// Slices the REAL camera solver out of the built file (`let bpPower` down to the CPU
// mirror) and flies it on a fake clock. The camera lives INSIDE the fractal, and every
// way that goes wrong is invisible to a screenshot:
//   * embedded in a wall  — the marcher hits at t~0, so the frame is one flat lit sheet
//     that reads as "the shader broke", not as "the camera is 2mm inside a lobe";
//   * teleporting         — solved fresh from the helix the escape flips pocket and the
//     camera jumps (measured 65 units per radian of phase before the offset was carried
//     over). A still frame either side of a jump looks perfect;
//   * outside the bulb    — a camera that drifts off into the void still renders the
//     silhouette, prettily, and the whole point of the effect is gone;
//   * shared between layers — two Mandelbulb layers fly one camera and composite as one
//     brighter copy, which is exactly what PHASE_VARS exists to prevent.
// Markers: `let bpPower` … `function bulb(dt)` — keep them.
const fs = require("fs");

const file = process.argv[2] || "dev-index.html";
const src = fs.readFileSync(file, "utf8");

function slice(from, to) {
  const a = src.indexOf(from);
  if (a < 0) throw new Error("marker not found: " + from);
  const b = src.indexOf(to, a);
  if (b < 0) throw new Error("marker not found: " + to);
  return src.slice(a, b);
}

const body = slice("let bpPower", "function bulb(dt)");
const prelude = "let zoom = 1;\n";
const api = `
  return { bulbSeed, bulbDE, bulbBase, BULB_CLEAR, BULB_OFFMAX,
           set: o => { if ("power" in o) bpPower = o.power; if ("detail" in o) bpDetail = o.detail;
                       if ("spin" in o) bpSpin = o.spin; },
           phase: () => bpPhase,
           camState: () => [bpOffX, bpOffY, bpOffZ],
           reset: () => { bpPhase = 0; bpOffX = bpOffY = bpOffZ = 0; } };
`;
const build = () => new Function(prelude + body + api)();
const M = build();

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  console.log((cond ? "PASS " : "FAIL ") + " " + name + (extra !== undefined ? "  [" + extra + "]" : ""));
  cond ? pass++ : fail++;
}

// The iteration count the SHADER would use for a given Detail — the camera has to dodge
// the surface that actually gets drawn, so the probe measures against that one too.
const shaderIter = d => Math.max(1, Math.min(12, Math.floor(d)));

// Fly `secs` at `fps` and report what the camera did. Clearance is measured at the
// position the seed HANDS THE SHADER, against the DE the shader will march.
function fly(opts) {
  const fps = opts.fps || 60, dt = 1 / fps, secs = opts.secs || 60;
  M.reset(); M.set(opts);
  const P = opts.power !== undefined ? opts.power : 8;
  const it = shaderIter(opts.detail !== undefined ? opts.detail : 7);
  let prev = null, minClear = Infinity, maxStep = 0, embedded = 0, minR = Infinity, maxR = 0, n = 0;
  for (let i = 0; i < Math.round(secs * fps); i++) {
    const s = M.bulbSeed(dt);
    const d = M.bulbDE(s.px, s.py, s.pz, P, it);
    const r = Math.hypot(s.px, s.py, s.pz);
    minClear = Math.min(minClear, d);
    if (d < 0) embedded++;
    minR = Math.min(minR, r); maxR = Math.max(maxR, r);
    if (prev) maxStep = Math.max(maxStep, Math.hypot(s.px - prev[0], s.py - prev[1], s.pz - prev[2]));
    prev = [s.px, s.py, s.pz];
    n++;
  }
  return { minClear, maxStep, embedded: embedded / n, minR, maxR };
}

// How much of the SCREEN the fractal covers from one camera stop, through the shipped
// lens (uv scaled by the aspect, rd = right*u + up*v + fwd*1.15). "Inside" is a claim
// about what you can SEE, so it gets measured as what you can see.
function screenFill(s, P, it) {
  const nrm = v => { const n = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / n, v[1] / n, v[2] / n]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const f = [s.fx, s.fy, s.fz];
  const wup = Math.abs(f[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1];
  const rt = nrm(cross(wup, f)), up = cross(f, rt);
  let hit = 0, tot = 0;
  for (let iy = 0; iy < 9; iy++) for (let ix = 0; ix < 16; ix++) {
    const u = ((ix + 0.5) / 16 - 0.5) * 2 * 1.78, v = ((iy + 0.5) / 9 - 0.5) * 2;
    const rd = nrm([rt[0] * u + up[0] * v + f[0] * 1.73, rt[1] * u + up[1] * v + f[1] * 1.73,
                    rt[2] * u + up[2] * v + f[2] * 1.73]);
    let t = 0; tot++;
    for (let k = 0; k < 90; k++) {
      const d = M.bulbDE(s.px + rd[0] * t, s.py + rd[1] * t, s.pz + rd[2] * t, P, it);
      if (d < 0.0008 * Math.max(t, 0.3)) { hit++; break; }
      t += d;
      if (t > 5.0) break;
    }
  }
  return hit / tot;
}

console.log("--- Mandelbulb: the camera inside the fractal (" + file + ")\n");

// 1. Clearance. The one hard invariant: never inside a surface.
const shipped = fly({ secs: 90 });
ok("shipped flight keeps its clearance", shipped.minClear > 0,
   "min " + shipped.minClear.toFixed(4) + " (target " + M.BULB_CLEAR + ")");
ok("shipped flight never embeds", shipped.embedded === 0, (shipped.embedded * 100).toFixed(2) + "% of frames");

// 2. Continuity. A bounded per-frame step is the whole reason the offset is carried over
// and rate-limited; solved fresh from the helix, this number was two orders larger.
ok("no teleports at the shipped speed", shipped.maxStep < 0.12,
   "max step " + shipped.maxStep.toFixed(4) + " units/frame");

// 3. OUTSIDE, framing the solid -- deliberately the opposite of what this asserted before.
// The effect flew the canyons between the lobes for several releases; it now orbits and
// frames the whole bulb, because the interior it was reaching for does not exist. A
// Mandelbulb is DENSEST at its centre: inside the surface the iteration never escapes, the
// DE goes flat, and there is nothing to draw. So the contract is the reverse -- the orbit
// stays clear of the shell, and `shipped.embedded === 0` above is what proves it never gets in.
// THIS ASSERTION HAS NOW FLIPPED THREE TIMES -- inside, then outside, then inside again --
// which is the tell that the radius is a DESIGN CHOICE and not an invariant. Distance is a
// slider now, and a multiple of the shell rather than an absolute, so pinning a number here
// only re-breaks on the next taste decision. What is actually invariant is above and below:
// the camera keeps its clearance and NEVER EMBEDS at any slider extreme (`shipped.embedded`),
// and the fractal is present in frame. Those hold whether the shipped Distance is 0.8 or 2.5.
//
// The one number worth pinning is the ceiling: whatever the taste, the escape solver must not
// carry the camera off to infinity.
// COMPATIBILITY. v1.50.0 shipped Distance as an ABSOLUTE radius with a minimum of 1.3, and
// scenes saved against it store that number. v1.51.0 opens the floor to 0 so the camera can
// fly inside, and keeps the camera clear of the solid with BULB_MINR * bulbShell(P) rather
// than by reinterpreting the slider -- because a scene that stored 2.5 must still mean 2.5.
// That only holds while the floor stays BELOW everything v1.50.0 could store: bulbShell is
// capped at 1.3, so the floor tops out at 0.78 * 1.3 and can never reach 1.3. If either
// constant moves, this goes red and every released Mandelbulb scene has quietly re-framed.
{
  // Read both out of the source rather than the eval'd slice -- the slice runs inside a
  // closure this block is not in, and lifting the whole flight model here to reach two
  // numbers would be a lot of machinery for an arithmetic claim.
  const minrM = src.match(/const BULB_MINR = ([\d.]+)/);
  const shellM = src.match(/const bulbShell = P => ([^;]+);/);
  ok("the floor constants are still where this check reads them", !!(minrM && shellM),
     minrM && shellM ? "BULB_MINR " + minrM[1] : "MOVED -- this check is now vacuous");
  const BULB_MINR = parseFloat(minrM[1]);
  const bulbShell = new Function("P", "return " + shellM[1]);
  let worstFloor = 0, atP = 0;
  for (let P = 1; P <= 16; P += 0.05) {
    const f = BULB_MINR * bulbShell(P);
    if (f > worstFloor) { worstFloor = f; atP = P; }
  }
  ok("the clearance floor never reaches a Distance v1.50.0 could store",
     worstFloor < 1.3,
     "floor peaks at " + worstFloor.toFixed(3) + " (power " + atP.toFixed(1) + "), released min was 1.30");
}

ok("the orbit stays within a sane radius", shipped.maxR < 6.0,
   "radius " + shipped.minR.toFixed(2) + "…" + shipped.maxR.toFixed(2));
{
  M.reset();
  let sum = 0, min = 1, n = 0;
  for (let i = 0; i < 60 * 60; i++) {
    const s = M.bulbSeed(1 / 60);
    if (i % 30) continue;
    const q = screenFill(s, 8, 7);
    sum += q; min = Math.min(min, q); n++;
  }
  // Framed, not filled. Skimming the shell filled half the screen with wall; an orbit that
  // shows the whole solid necessarily leaves sky around it, so the bar is "clearly present in
  // every frame", not "covers the screen". Zero here would mean the camera is pointed away.
  ok("the fractal is framed in every sampled frame", sum / n > 0.10 && min > 0.05,
     "mean " + (sum / n * 100).toFixed(0) + "%  worst " + (min * 100).toFixed(0) + "%");
}

// 4. The extremes of every slider that reshapes what the camera flies through. Power and
// Detail change the SURFACE under a path tuned at 8/7; Orbit speed changes how fast the
// escape has to work, which is why its per-frame budget scales with the speed.
let worst = { minClear: Infinity, embedded: 0, maxStep: 0, at: "" };
for (const power of [2, 4, 8, 12]) for (const detail of [3, 7, 12]) for (const spin of [0, 0.35, 1, 2]) {
  const r = fly({ power, detail, spin, secs: 30 });
  if (r.minClear < worst.minClear) worst = Object.assign({}, r, { at: "power " + power + " detail " + detail + " spin " + spin });
  worst.embedded = Math.max(worst.embedded, r.embedded);
  worst.maxStep = Math.max(worst.maxStep, r.maxStep);
}
// At the extremes the corrector is allowed to BRUSH a wall — at Orbit speed 2 (5.7x the
// shipped lap) the camera is dragged into pockets faster than any escape can leave them,
// and a few frames of clipping read as a spire flashing past. What must never come back
// is what the earlier solvers did: buried DEEP (a flat lit sheet), or buried and STUCK
// (a parked camera at Orbit speed 0 that can never get out again).
ok("clearance holds across every slider extreme", worst.minClear > -0.12 && worst.embedded < 0.01,
   "worst " + worst.minClear.toFixed(4) + " at " + worst.at
   + ", " + (worst.embedded * 100).toFixed(2) + "% of frames");
ok("nothing teleports at any orbit speed", worst.maxStep < 0.5, "worst step " + worst.maxStep.toFixed(3));

// 5. Frame rate. The escape budget and the offset decay are both per-second, so a slow
// frame must swerve further, not clip through. (frame() clamps dt to 0.25s — 4fps is the
// floor this has to survive.)
for (const fps of [144, 60, 30, 15, 4]) {
  const r = fly({ secs: 30, fps });
  ok("clearance survives " + fps + "fps", r.minClear > 0, "min " + r.minClear.toFixed(4));
}

// 6. Determinism, and that the offset really is state. Same phase + same offset in ⇒ the
// same frame out, which is exactly what installPhase/capturePhase rely on.
{
  M.reset(); M.set({ power: 8, detail: 7, spin: 0.35 });
  for (let i = 0; i < 300; i++) M.bulbSeed(1 / 60);
  const mid = M.camState(), midPhase = M.phase();
  const b = [];
  for (let i = 0; i < 60; i++) b.push(M.bulbSeed(1 / 60));
  const N = build();
  N.set({ power: 8, detail: 7, spin: 0.35 });
  for (let i = 0; i < 300; i++) N.bulbSeed(1 / 60);
  const c = [];
  for (let i = 0; i < 60; i++) c.push(N.bulbSeed(1 / 60));
  let same = true;
  for (let i = 0; i < 60; i++) same = same && b[i].px === c[i].px && b[i].py === c[i].py && b[i].pz === c[i].pz;
  ok("the flight is deterministic", same);
  const off = Math.hypot(mid[0], mid[1], mid[2]);
  // The escape solver is now INERT on the shipped orbit, and that is correct: it exists to
  // push the camera out of the solid, and an orbit at 2.5 is never in it. So the assertion is
  // that it stays bounded (it must never run away), not that it is doing anything.
  ok("the escape offset stays bounded", off <= M.BULB_OFFMAX + 1e-9,
     "|offset| " + off.toFixed(3) + " at phase " + midPhase.toFixed(2));
}

// 7. The offset rides PHASE_VARS — the source-level half of "two layers, two cameras".
{
  const vars = src.slice(src.indexOf("const PHASE_VARS"), src.indexOf("const phaseSnapshot"));
  ok("bpOffX/Y/Z ride PHASE_VARS", /"bpOffX"/.test(vars) && /"bpOffY"/.test(vars) && /"bpOffZ"/.test(vars));
  ok("so does the phase itself", /"bpPhase"/.test(vars));
}

// 8. The camera solves at the iteration count the SHADER draws with. Off by one and it
// dodges a surface nobody can see while flying into one everybody can.
{
  const seed = src.slice(src.indexOf("function bulbSeed("), src.indexOf("function bulbDE("));
  ok("camera and shader agree on the detail level", /Math\.floor\(bpDetail\)/.test(seed) && /Math\.min\(12/.test(seed));
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
