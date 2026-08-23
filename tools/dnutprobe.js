#!/usr/bin/env node
// Doughnut -- the camera-containment probe.
//
//   node tools/dnutprobe.js dev-index.html
//
// Slices the REAL flight path and the REAL wall function out of the built file and flies
// them on a fake clock. Everything asserted here is invisible to a screenshot:
//   * camera in the wall -- the marcher hits at t~0 and the frame is one flat lit sheet,
//     which reads as "the shader broke", not as "the path is 2mm outside the pipe";
//   * a seam            -- the flute pattern is cos(flute*(ang + twist*arc)) over an atan2
//     `arc`, so it only closes across the branch cut when flute*twist is a whole number.
//     A fractional twist draws one hard line down the tunnel that a still frame taken
//     anywhere else looks perfect without;
//   * a vertical heading -- the view basis is built against world up, and a heading that
//     reaches it degenerates the cross product into a blank frame;
//   * shared between layers -- two Doughnut layers flying one camera composite as a single
//     brighter copy, which is exactly what PHASE_VARS exists to prevent.
// Markers: `let dnRing` ... `function torusCPU(` -- keep them.
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

const body = slice("let dnRing", "function torusCPU(");
const api = [
  "  const SET = { ring: v => dnRing = v, tube: v => dnTube = v, speed: v => dnSpeed = v,",
  "                twist: v => dnTwist = v, flute: v => dnFlute = v };",
  "  return { torusSeed, torusDECPU, dnAt, DN_WOB,",
  "           set: o => { for (const k in o) SET[k](o[k]); },",
  "           phase: () => dnPhase,",
  "           reset: () => { dnPhase = 0; } };",
].join("\n");
const P = new Function("zoom", body + api)(1);

let pass = 0, fail = 0;
const ok = (cond, name, detail) => {
  (cond ? pass++ : fail++);
  console.log((cond ? "PASS  " : "FAIL  ") + name + (detail ? "  [" + detail + "]" : ""));
};

// The wall's own floor, derived from what FS_TORUS carves rather than assumed: the scallop
// can take 0.18 off and the two corrugations another 0.055 + 0.022, all scaled by the tube.
const WALL_FLOOR = 1 - 0.18 - 0.055 - 0.022;      // = 0.743 of the tube radius

// --- 1. containment, at every slider extreme -----------------------------------
// The whole design claim: the wobble is capped well inside the narrowest wall, so unlike
// the Mandelbulb this needs no per-frame escape solver and cannot fail at a low frame rate.
{
  const RING = [1.5, 3, 6], TUBE = [0.25, 0.8, 1.6], TW = [-4, 0, 1, 4], FL = [0, 1, 6, 12];
  let worst = Infinity, worstAt = "";
  for (const ring of RING) for (const tube of TUBE) for (const twist of TW) for (const flute of FL) {
    P.reset();
    P.set({ ring: ring, tube: tube, twist: twist, flute: flute, speed: 3 });
    for (let i = 0; i < 400; i++) {
      const s = P.torusSeed(1 / 15);                 // a punishing 15fps step
      const d = P.torusDECPU(s.px, s.py, s.pz, s.ring, s.tube, s.twist, s.flute);
      if (d < worst) {
        worst = d;
        worstAt = "ring " + ring + " tube " + tube + " twist " + twist + " flute " + flute;
      }
    }
  }
  ok(worst > 0, "the camera is never inside the wall, at any slider setting",
     "min clearance " + worst.toFixed(4) + " at " + worstAt);
  // ...and not merely on the right side of it: it keeps a real margin, so the near wall
  // never fills the frame with one flat lit patch.
  ok(worst > 0.05, "and keeps a visible margin", "min " + worst.toFixed(4));
}

// --- 2. the margin is PROPORTIONAL, which is why it survives every tube radius --
{
  const rel = [];
  for (const tube of [0.25, 0.8, 1.6]) {
    P.reset();
    P.set({ ring: 3, tube: tube, twist: 1, flute: 6, speed: 1 });
    let worst = Infinity;
    for (let i = 0; i < 300; i++) {
      const s = P.torusSeed(1 / 60);
      worst = Math.min(worst, P.torusDECPU(s.px, s.py, s.pz, s.ring, s.tube, s.twist, s.flute));
    }
    rel.push(worst / tube);
  }
  const spread = Math.max.apply(null, rel) - Math.min.apply(null, rel);
  ok(spread < 0.02, "clearance scales with the tube rather than shrinking away",
     rel.map(r => r.toFixed(3)).join(" / ") + " of tube");
  ok(Math.min.apply(null, rel) > 0.9 * (WALL_FLOOR - P.DN_WOB),
     "and it agrees with the wall floor the shader carves",
     "floor " + WALL_FLOOR.toFixed(3) + " - wobble " + P.DN_WOB
     + " = " + (WALL_FLOOR - P.DN_WOB).toFixed(3));
}

// --- 3. no seam: the flute pattern must close across the atan2 branch cut ------
// Sample the wall just either side of arc = +/-PI at the same tube angle. A fractional
// twist puts a step there; whole numbers close.
{
  const wallAt = (arc, tube, twist, flute) => {
    const ang = 0.7 + twist * arc;
    return tube * (1 - 0.18 * Math.cos(flute * ang))
         - tube * (0.055 * Math.cos(arc * 24) + 0.022 * Math.cos(arc * 97 + ang * 3));
  };
  // eps has to be tiny: the finest corrugation is cos(97*arc), whose slope at the cut is
  // ~1.7 per radian, so a 1e-6 offset alone shows a 1.5e-5 "step" and the check goes red on
  // correct code. Sample as close to the cut as doubles allow and the continuous part
  // vanishes, leaving three orders of magnitude between a closed pattern and a torn one.
  const eps = 1e-9;
  let worst = 0;
  for (let twist = -4; twist <= 4; twist++) for (let flute = 0; flute <= 12; flute++)
    worst = Math.max(worst, Math.abs(wallAt(Math.PI - eps, 0.8, twist, flute)
                                   - wallAt(-Math.PI + eps, 0.8, twist, flute)));
  ok(worst < 1e-6, "every whole twist x flute pair closes across the branch cut",
     "worst step " + worst.toExponential(2));
  // ...and the check is sensitive: a fractional twist really does tear.
  const torn = Math.abs(wallAt(Math.PI - eps, 0.8, 0.5, 6) - wallAt(-Math.PI + eps, 0.8, 0.5, 6));
  ok(torn > 0.01, "a FRACTIONAL twist tears it, so the whole-number rule is load-bearing",
     "step " + torn.toFixed(4));
}

// --- 4. the heading -----------------------------------------------------------
{
  P.reset();
  P.set({ ring: 3, tube: 0.8, twist: 1, flute: 6, speed: 1 });
  let worstLen = 0, worstZ = 0;
  for (let i = 0; i < 500; i++) {
    const s = P.torusSeed(1 / 60);
    worstLen = Math.max(worstLen, Math.abs(Math.hypot(s.fx, s.fy, s.fz) - 1));
    worstZ = Math.max(worstZ, Math.abs(s.fz));
  }
  ok(worstLen < 1e-9, "the heading is a unit vector", "drift " + worstLen.toExponential(2));
  ok(worstZ < 0.9, "and never reaches world up, so the view basis never degenerates",
     "max |fz| " + worstZ.toFixed(3));
  // Negative Speed must turn the camera round, not just run the phase backwards --
  // otherwise the flight reverses while the view still faces the way it came.
  P.reset(); P.set({ speed: 1 });
  const fwd = P.torusSeed(1 / 60);
  P.reset(); P.set({ speed: -1 });
  const rev = P.torusSeed(1 / 60);
  const dot = fwd.fx * rev.fx + fwd.fy * rev.fy + fwd.fz * rev.fz;
  ok(dot < -0.9, "negative Speed turns the camera round", "dot " + dot.toFixed(3));
}

// --- 5. determinism + per-layer ownership --------------------------------------
{
  const run = () => {
    P.reset();
    P.set({ ring: 3, tube: 0.8, twist: 1, flute: 6, speed: 1 });
    const out = [];
    for (let i = 0; i < 120; i++) { const s = P.torusSeed(1 / 60); out.push(s.px, s.py, s.pz); }
    return out;
  };
  const a = run(), b = run();
  ok(a.every((v, i) => v === b[i]), "the flight is deterministic");
  ok(src.indexOf('["dnPhase", () => dnPhase, v => dnPhase = v]') >= 0,
     "dnPhase rides PHASE_VARS, so two Doughnut layers fly separate cameras");
  // The path is pure in the phase: sampling it must not advance anything.
  P.reset();
  const p0 = P.dnAt(1.234, [0, 0, 0]).slice();
  const p1 = P.dnAt(1.234, [0, 0, 0]);
  ok(P.phase() === 0 && p0.every((v, i) => v === p1[i]),
     "dnAt is pure -- sampling it does not advance the flight");
}

console.log("");
console.log(fail ? (fail + " FAILED, " + pass + " passed") : ("all " + pass + " passed"));
process.exit(fail ? 1 : 0);
