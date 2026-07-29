#!/usr/bin/env node
// Bouncing solids — rigid-body probe.
//
//   node tools/solidsprobe.js dev-index.html
//
// Slices the REAL physics out of the built file (the block from `const SOLID_SHAPES`
// down to the CPU mirror) and drives it on a fake clock against stub globals. It exists
// because the failure modes here are invisible to a screenshot: a body that tunnels
// through a wall is off-screen (so the frame just looks emptier), a quaternion that
// stops being unit length shears the primitive slowly enough to read as "art", and two
// stacked layers sharing one body list renders as ONE layer that is merely brighter.
// None of those go red on their own; all of them are one assertion each here.
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

// The physics + uniform staging. Stops before the CPU mirror, which needs the frame
// buffers and is exercised in the browser probe instead.
const body = slice("const SOLID_SHAPES", "// ---- CPU mirror of FS_SOLIDS");

// Stub the handful of globals the slice closes over. `v3` is the real thing, copied from
// tetrahedron-physics.js — it is four one-line vector helpers and stubbing it wrong would
// silently invalidate every assertion below.
const prelude = `
  const v3 = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  };
  let fw = 640, fh = 360, zoom = 1;
  let stack = [];
`;

const api = `
  return { solidsSeed, installSolids, makeSolid, ensureSolids, SOLID_BOX, SOLID_SHAPES, SD_MAX,
           get sdBodies(){ return sdBodies; },
           setStack: s => { stack = s; },
           set: o => { if ("count" in o) sdCount = o.count; if ("size" in o) sdSize = o.size;
                       if ("speed" in o) sdSpeed = o.speed; if ("spin" in o) sdSpin = o.spin;
                       if ("mix" in o) sdMix = o.mix; if ("rim" in o) sdRim = o.rim; },
           aspect: (w, h) => { fw = w; fh = h; } };
`;

const M = new Function(prelude + body + api)();

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  const line = (cond ? "PASS " : "FAIL ") + " " + name + (extra !== undefined ? "  [" + extra + "]" : "");
  console.log(line);
  cond ? pass++ : fail++;
}
// Run `n` steps of `dt` and hand back the last staged uniform set.
function run(n, dt) { let s = null; for (let i = 0; i < n; i++) s = M.solidsSeed(dt); return s; }
// How far outside the room the worst body reaches (negative ⇒ everything is inside).
function overshoot(s) {
  let worst = -Infinity;
  for (let b = 0; b < s.count; b++)
    for (let ax = 0; ax < 3; ax++)
      worst = Math.max(worst, Math.abs(s.pos[b * 4 + ax]) - M.SOLID_BOX[ax]);
  return worst;
}
// Two different questions, so two functions. The BODIES hold doubles and their
// quaternions must be normalised exactly (drift there compounds every frame and shears
// the primitive); the staged uniforms are a Float32Array, whose ~1e-7 rounding is the
// upload format and nothing to do with the maths. Asserting double-tolerance on the
// staged copy is how this probe first went red on a correct implementation.
function quatErr() {
  let worst = 0;
  for (const S of M.sdBodies) worst = Math.max(worst, Math.abs(Math.hypot(S.Q[0], S.Q[1], S.Q[2], S.Q[3]) - 1));
  return worst;
}
function quatErrStaged(s) {
  let worst = 0;
  for (let b = 0; b < s.count; b++)
    worst = Math.max(worst, Math.abs(Math.hypot(s.quat[b * 4], s.quat[b * 4 + 1], s.quat[b * 4 + 2], s.quat[b * 4 + 3]) - 1));
  return worst;
}
const F32 = 2e-7;   // float32 round-trip tolerance, for anything read back off a staging buffer

console.log("--- Bouncing solids: rigid bodies (" + file + ")\n");

// ---- staging ---------------------------------------------------------------------
M.set({ count: 5, size: 0.26, speed: 1, spin: 1, mix: 6 });
let s = M.solidsSeed(1 / 60);
ok("seeds the requested body count", s.count === 5, s.count);
ok("radius is staged into uPos.w", Math.abs(s.pos[3] - 0.26) < F32, s.pos[3]);
ok("the room follows the frame aspect", Math.abs(M.SOLID_BOX[0] - M.SOLID_BOX[1] * (640 / 360)) < 1e-9,
   M.SOLID_BOX.map(v => v.toFixed(3)).join(" x "));

// ---- motion ----------------------------------------------------------------------
const p0 = [s.pos[0], s.pos[1], s.pos[2]];
s = run(120, 1 / 60);
const p1 = [s.pos[0], s.pos[1], s.pos[2]];
ok("bodies travel", Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]) > 0.05,
   "moved " + Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]).toFixed(3));
const q0 = [s.quat[0], s.quat[1], s.quat[2], s.quat[3]];
s = run(60, 1 / 60);
ok("bodies tumble", Math.abs(s.quat[0] - q0[0]) + Math.abs(s.quat[1] - q0[1]) + Math.abs(s.quat[2] - q0[2]) > 1e-4);

// ---- containment: the classic failure is tunnelling --------------------------------
s = run(6000, 1 / 60);
ok("no body escapes the room over 6000 steps", overshoot(s) <= 1e-9, "worst " + overshoot(s).toExponential(2));
ok("quaternions stay unit length", quatErr() < 1e-12, "worst |q|-1 = " + quatErr().toExponential(2));
ok("...and survive the float32 upload", quatErrStaged(s) < F32, quatErrStaged(s).toExponential(2));

// A backgrounded tab hands back one enormous dt. Unclamped, a body crosses the whole
// room in a single step and the wall test never sees it — it leaves and never returns.
s = M.solidsSeed(9.5);
ok("a 9.5s frame is clamped, not tunnelled", overshoot(s) <= 1e-9, "worst " + overshoot(s).toExponential(2));
s = run(20, 3.0);
ok("...and repeated giant frames stay contained", overshoot(s) <= 1e-9, "worst " + overshoot(s).toExponential(2));

// Same at the extremes of every slider that feeds the physics.
M.set({ speed: 4, spin: 4, size: 0.5, count: 8 });
s = run(4000, 1 / 60);
ok("contained at max Speed/Tumble/Size/Count", overshoot(s) <= 1e-9, "worst " + overshoot(s).toExponential(2));
ok("...quaternions still unit there", quatErr() < 1e-12, quatErr().toExponential(2));

// Size 0.5 in a room of half-height 0.72 still leaves room; push past it and the guard
// must simply leave the body alone rather than divide by a negative limit.
M.set({ size: 0.5, count: 3 });
M.aspect(100, 640);                    // a tall, narrow frame ⇒ x limit smaller than the radius
s = run(300, 1 / 60);
ok("a body wider than the room does not explode", s.pos.every(v => Number.isFinite(v)));
M.aspect(640, 360);
M.set({ size: 0.26, speed: 1, spin: 1, count: 5 });

// ---- Speed 0 / Tumble 0 are real settings, not degenerate --------------------------
M.set({ speed: 0 });
const froz = M.solidsSeed(1 / 60);
const fx = [froz.pos[0], froz.pos[1], froz.pos[2]];
s = run(200, 1 / 60);
ok("Speed 0 freezes travel", Math.abs(s.pos[0] - fx[0]) < 1e-12 && Math.abs(s.pos[1] - fx[1]) < 1e-12);
M.set({ speed: 1, spin: 0 });
const qf = [s.quat[0], s.quat[1], s.quat[2], s.quat[3]];
s = run(200, 1 / 60);
ok("Tumble 0 holds orientation", Math.abs(s.quat[0] - qf[0]) < 1e-12 && Math.abs(s.quat[3] - qf[3]) < 1e-12);
M.set({ spin: 1 });

// ---- Shape mix ---------------------------------------------------------------------
M.set({ count: 8, mix: 1 });
s = M.solidsSeed(1 / 60);
ok("Shape mix 1 ⇒ every body is a sphere", [...s.shape.slice(0, s.count)].every(v => v === 0));
M.set({ mix: 6 });
s = M.solidsSeed(1 / 60);
ok("Shape mix 6 ⇒ all six primitives in play",
   new Set([...s.shape.slice(0, s.count)]).size === 6, [...new Set([...s.shape.slice(0, s.count)])].join(","));
M.set({ mix: 3 });
s = M.solidsSeed(1 / 60);
ok("Shape mix 3 ⇒ exactly three kinds", new Set([...s.shape.slice(0, s.count)]).size === 3);
ok("...and never names a primitive the shader lacks",
   [...s.shape.slice(0, s.count)].every(v => v >= 0 && v < M.SOLID_SHAPES));
M.set({ mix: 6 });

// ---- Count is clamped to the shader's array size ------------------------------------
M.set({ count: 99 });
s = M.solidsSeed(1 / 60);
ok("Count is clamped to SD_MAX (the shader array size)", s.count === M.SD_MAX, s.count);
M.set({ count: 0 });
s = M.solidsSeed(1 / 60);
ok("Count below 1 still yields a body", s.count === 1, s.count);
M.set({ count: 5 });

// ---- per-layer bodies ----------------------------------------------------------------
// Two stacked Bouncing solids layers must own separate body lists. Sharing one renders
// as a single layer that is merely brighter — no error, nothing on screen to point at.
const A = { fx: 0, solids: [] }, B = { fx: 0, solids: [] };
M.setStack([A, B]);
M.installSolids(A); run(90, 1 / 60);
M.installSolids(B); run(30, 1 / 60);
ok("each layer owns its body list", A.solids !== B.solids && A.solids.length > 0 && B.solids.length > 0,
   A.solids.length + " / " + B.solids.length);
ok("...and they hold different poses (not lockstep)",
   Math.hypot(A.solids[0].P[0] - B.solids[0].P[0],
              A.solids[0].P[1] - B.solids[0].P[1],
              A.solids[0].P[2] - B.solids[0].P[2]) > 1e-6,
   "separation " + Math.hypot(A.solids[0].P[0] - B.solids[0].P[0],
                              A.solids[0].P[1] - B.solids[0].P[1],
                              A.solids[0].P[2] - B.solids[0].P[2]).toFixed(4));
// Stepping one layer must not move the other.
M.installSolids(A);
const bBefore = B.solids[0].P.slice();
run(120, 1 / 60);
ok("stepping one layer leaves the other still",
   Math.abs(B.solids[0].P[0] - bBefore[0]) < 1e-12 && Math.abs(B.solids[0].P[1] - bBefore[1]) < 1e-12);

// ---- determinism: no Math.random on this path ----------------------------------------
// The chaos PRNG must stay untouched (see Determinism in CLAUDE.md), and a reload has to
// reproduce the same opening frame — both follow from the start state being a pure
// function of (body index, layer index).
const s1 = JSON.stringify(M.makeSolid(2, 1));
const s2 = JSON.stringify(M.makeSolid(2, 1));
ok("start state is deterministic", s1 === s2);
ok("layer 0 differs from layer 1", JSON.stringify(M.makeSolid(2, 0)) !== s1);
ok("body 2 differs from body 3", JSON.stringify(M.makeSolid(3, 1)) !== s1);
// Strip line comments before grepping: this file's own comments SAY "no Math.random",
// which is exactly the string being searched for, so a raw includes() reports a call
// that isn't there. Look for the call form, in code only.
const code = body.split("\n").map(l => l.replace(/\/\/.*$/, "")).join("\n");
ok("no Math.random call on the solids path", !/Math\s*\.\s*random/.test(code));

// ---- the OPENING frame must already look like a scene ---------------------------------
// The first implementation seeded x as 0.55·sin(k·3.1); 3.1 is π to 1.3%, so every body
// started at x≈0 and the scene opened as a single column that only spread out after a few
// bounces. Assert real separation on EVERY axis at t=0, per axis independently — a clump
// in one axis is exactly what a correlated seed produces and what a 3D-looking start needs
// to rule out.
{
  const SIZE = 0.26;
  M.set({ size: SIZE });
  M.solidsSeed(1 / 60);                                   // refresh SOLID_BOX[0] for the aspect
  const bodies = Array.from({ length: 8 }, (_, k) => M.makeSolid(k, 0, SIZE));
  const axis = ["x", "y", "z"];
  for (let ax = 0; ax < 3; ax++) {
    // Judge the spread against the room that is actually AVAILABLE on this axis
    // (SOLID_BOX − radius), not an absolute number: x is the widest (it follows the frame
    // aspect) and z the shallowest, so one fixed threshold is either vacuous or unmeetable.
    const avail = M.SOLID_BOX[ax] - SIZE;
    const vs = bodies.map(b => b.P[ax]);
    const spread = Math.max(...vs) - Math.min(...vs);
    ok("start positions fill the room along " + axis[ax], spread > 1.2 * avail,
       "range " + spread.toFixed(3) + " of " + (2 * avail).toFixed(3) + " available");
    // ...and not merely spread but genuinely un-clustered around the origin
    const meanAbs = vs.reduce((a, v) => a + Math.abs(v), 0) / vs.length;
    ok("...and are not clustered at " + axis[ax] + "=0", meanAbs > 0.3 * avail,
       "mean |" + axis[ax] + "| = " + meanAbs.toFixed(3));
  }
  // No body may start outside the room, or it opens as a flat clipped face against a wall.
  let outside = 0;
  for (const b of bodies)
    for (let ax = 0; ax < 3; ax++)
      if (Math.abs(b.P[ax]) + SIZE > M.SOLID_BOX[ax] + 1e-9) outside++;
  ok("no body starts embedded in a wall", outside === 0, outside + " of 24 axes");
  // Same at the largest size the slider allows — the seed must scale with the room, and
  // this is the case a fixed range gets wrong.
  M.set({ size: 0.5 });
  M.solidsSeed(1 / 60);
  const big = Array.from({ length: 8 }, (_, k) => M.makeSolid(k, 0, 0.5));
  let outsideBig = 0;
  for (const b of big)
    for (let ax = 0; ax < 3; ax++)
      if (Math.abs(b.P[ax]) + 0.5 > M.SOLID_BOX[ax] + 1e-9) outsideBig++;
  ok("...nor at the maximum Size", outsideBig === 0, outsideBig + " of 24 axes");
  M.set({ size: SIZE });
  // Every body must actually be moving, or it hangs in mid-air until something hits it.
  const still = bodies.filter(b => Math.hypot(b.V[0], b.V[1], b.V[2]) < 0.05).length;
  ok("every body starts moving", still === 0, still + " stationary");
}

// ---- staged uniforms are always finite -----------------------------------------------
M.set({ count: 8, size: 0.4, speed: 3, spin: 3, mix: 6 });
s = run(2000, 1 / 60);
ok("every staged position is finite", [...s.pos].every(Number.isFinite));
ok("every staged quaternion is finite", [...s.quat].every(Number.isFinite));

console.log("\n" + (fail ? fail + " FAILED, " : "all ") + (fail ? pass + " passed" : pass + " passed"));
process.exit(fail ? 1 : 0);
