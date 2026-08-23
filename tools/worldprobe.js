#!/usr/bin/env node
// The shared 3D world -- the invariants a screenshot cannot show.
//
//   node tools/worldprobe.js dev-index.html
//
// Several layers are traced as ONE scene so a Glass ball reflects in the Ocean and the
// Ocean reflects in the ball. The output is a G-buffer (heat in .r, object ID in .g) and
// each joined layer picks its own pixels out of it, which is what keeps per-layer palettes
// working. Every way that goes wrong is invisible or misleading in a still frame:
//   * a frozen world      -- a joined layer's fx.draw(dt) never runs, so glWorldDraw is the
//     ONLY place its clock still advances. Pass 0 and the geometry renders perfectly and
//     simply never moves, which reads as a paused scene, not as a missing argument.
//     (Shipped that way for one build.)
//   * a dropped scale     -- a placed SDF must return de_local * scale. Without it the
//     marcher steps in local units through world space, overshoots and punches holes in
//     the object, which reads as "the shader is broken".
//   * ID bleed            -- a fuzzy ID compare in the pick pass hands one layer another
//     layer's heat, so two effects share one palette and nothing errors.
//   * ID 0                -- 0 means "nothing was hit", so a layer holding it would be
//     handed the background.
//   * a stale plan        -- worldPlan is module state read inside the layer loop; if it
//     were not rebuilt at the top of every renderStackColor it would outlive its layers,
//     and renderPrevScene calls that function a second time per frame with a DIFFERENT
//     stack.
// Markers: `const WORLD_KINDS` ... `function glWorldPick(` -- keep them.
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
const NL = String.fromCharCode(10);
const noComments = s => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (typeof name !== "string") { console.log("FAIL  ok() arguments swapped"); fail++; return; }
  (cond ? pass++ : fail++);
  console.log((cond ? "PASS  " : "FAIL  ") + name + (detail ? "  [" + detail + "]" : ""));
};

// --- 1. planWorld, run for real -------------------------------------------------
{
  const body = slice("  const WORLD_KINDS", "  function glWorldDraw(");
  const api = [
    "  return { WORLD_KINDS, planWorld };",
  ].join("\n");
  // Stubs: the plan only needs each layer's effect id and whether it has joined.
  const EFFECTS = [{ id: "ocean" }, { id: "glass" }, { id: "plasma" }, { id: "mandelbulb" },
                   { id: "solids" }, { id: "qjulia" }, { id: "vballs" }];
  const layerWorld = L => !!L.joined;
  const P = new Function("EFFECTS", "layerWorld", body + api)(EFFECTS, layerWorld);

  const L = (fx, joined) => ({ fx, joined });
  ok("nothing joined ⇒ no world at all", P.planWorld([L(0, false), L(1, false)]) === null);
  ok("a layer whose effect cannot join is ignored",
     P.planWorld([L(2, true), L(3, true)]) === null, "plasma + mandelbulb");

  const a = L(0, true), b = L(1, true), c = L(4, true), d = L(5, true), e = L(6, true);
  // More kinds than STACK_MAX on purpose: the plan must not care how many can join, only
  // that each kind claims one slot and each claim gets its own ID.
  const plan = P.planWorld([a, b, c, d, e]);
  ok("every joinable kind can share one world",
     !!plan && plan.oc === a && plan.gb === b && plan.sd === c && plan.qj === d && plan.vb === e);
  const ids = [...plan.ids.values()];
  ok("every joined layer gets an ID", plan.ids.size === 5, ids.join(","));
  ok("IDs are unique", new Set(ids).size === ids.length, ids.join(","));
  // 0 is "nothing was hit" in the G-buffer, so no layer may hold it.
  ok("no layer is given ID 0 -- that is the background", ids.every(v => v >= 1), ids.join(","));

  // One per kind, first in stack order, and the LOSER must still render itself.
  const g1 = L(1, true), g2 = L(1, true);
  const p2 = P.planWorld([g1, g2]);
  ok("only one layer per effect kind joins", p2.ids.size === 1);
  ok("...and it is the first in stack order", p2.ids.has(g1) && !p2.ids.has(g2));

  // The owner -- whose camera the world uses -- is the lowest joined layer.
  const p3 = P.planWorld([L(2, true), b, a]);
  ok("the first joined layer owns the camera", p3.ids.keys().next().value === b,
     "glass came before ocean in the stack");
}

// --- 2. the placement scale, which the march depends on -------------------------
{
  const glassDE = slice("    float glassDE(vec3 p){", "    // The SDF union.");
  ok("a placed SDF divides the point by the scale", /\(p - uGbPlace\.xyz\)\/uGbPlace\.w/.test(glassDE));
  ok("...and MULTIPLIES the distance back by it", /return d\*uGbPlace\.w;/.test(glassDE),
     "without this the marcher overshoots and the object gains holes");
  // EVERY placed group, not just the first: the multiply is easy to forget on the next one.
  // The bodies are matched with a regex rather than sliced on a newline literal -- an
  // escaped newline written into probe source has a habit of becoming a REAL one and
  // breaking the string it sits in, which is the trap CLAUDE.md records for generators.
  const world = slice("    const FS_WORLD = ", "    const FS_WORLDPICK = ");
  for (const [fn, pl] of [["solidsDE", "uSdPlace"], ["qjuliaDE", "uQjPlace"],
                          ["vballsDE", "uVbPlace"]]) {
    // indexOf, not a regex: the escaping needed for "\(" and "\s" inside a JS string
    // inside a shell-written file collapsed twice, leaving a pattern that matched nothing
    // and two assertions that could only ever fail. Plain string search has no escapes.
    const head = "float " + fn + "(vec3 p){";
    const hi = world.indexOf(head);
    ok(fn + " is in the world shader", hi >= 0);
    if (hi < 0) continue;
    const close = world.indexOf(NL + "    }", hi);
    const b = world.slice(hi, close < 0 ? hi + 900 : close);
    ok(fn + " divides the point by its scale",
       b.indexOf("(p - " + pl + ".xyz)/" + pl + ".w") >= 0);
    // EVERY return path, including qjuliaDE's bounding-sphere shortcut -- that one is the
    // easy miss, because it reads as a plain early-out rather than as a distance.
    const rets = b.match(/return [^;]+;/g) || [];
    const scaled = rets.filter(r => r.indexOf(pl + ".w") >= 0);
    ok(fn + " multiplies EVERY returned distance back by it",
       rets.length > 0 && scaled.length === rets.length,
       scaled.length + " of " + rets.length + " returns");
  }
}

// --- 3. IDs through the G-buffer and back ---------------------------------------
{
  const world = slice("    const FS_WORLD = ", "    const FS_WORLDPICK = ");
  const pick = slice("    const FS_WORLDPICK = ", "\n    // ");
  ok("the world writes its ID into the G-buffer", /o = vec4\(clamp\(heat[^;]*id\/255\.0/.test(world));
  ok("a miss is ID 0, never a layer's", /id = uOcOn > 0\.5 \? uOcId : 0\.0;/.test(world));
  // step(|g*255 - id| < 0.5): an ID rides as id/255 through RGBA8 and comes back within
  // half a quantum. Anything looser mixes two layers' heat into one palette.
  ok("the pick pass compares IDs to within half a quantum",
     /step\(abs\(s\.g\*255\.0 - uId\), 0\.5\)/.test(pick), "exact, so no heat bleeds between layers");
  ok("...and the G-buffer is NEAREST-filtered",
     /glTex\.world = createTex\([^)]*gl\.NEAREST/.test(src),
     "interpolating two IDs invents a third that belongs to no layer");
}

// --- 4. the wiring: once per frame, before the layers, with a real dt ------------
{
  const rsc = slice("  function renderStackColor(", "  // THE OUTGOING SCENE");
  const bare = noComments(rsc);
  ok("worldPlan is rebuilt at the top of every renderStackColor",
     bare.indexOf("worldPlan = planWorld(live)") >= 0 &&
     bare.indexOf("worldPlan = planWorld(live)") < bare.indexOf("for (let li = 0"),
     "renderPrevScene calls this a second time per frame with a different stack");
  ok("the world is drawn before the layer loop", bare.indexOf("glWorldDraw(worldPlan, dt)") >= 0 &&
     bare.indexOf("glWorldDraw(worldPlan, dt)") < bare.indexOf("for (let li = 0"));
  ok("...and it is handed the REAL dt, not 0", /glWorldDraw\(worldPlan, dt\)/.test(rsc),
     "a joined layer's fx.draw never runs, so this is the only place its clock advances");
  const draw = slice("  function glWorldDraw(", "  function glWorldPick(");
  ok("the ocean's clock is advanced there", /oceanSeed\(dt\)/.test(draw));
  ok("and the glass ball's", /glassSeed\(dt\)/.test(draw));

  const rlh = noComments(slice("  function renderLayerHeat(", "  // Map a layer's heat"));
  ok("a joined layer picks instead of drawing itself",
     /if \(wid\) glWorldPick\(wid\);/.test(rlh) && /else \{ fx\.draw\(dt\); capturePhase\(L\); \}/.test(rlh));
}

// --- 5. joining is opt-in, so every existing scene is unchanged ------------------
{
  const lw = slice("  function layerWorld(L) {", "\n  function renderStackColor(");
  ok("layerWorld defaults to FALSE", /return fx\.world === true;/.test(lw),
     "=== true, not !== false: an effect that never heard of the world stays out");
  ok("the flag is per layer, with the same fallback chain as showBox",
     /L === stack\[stackSel\]/.test(lw) && /L\.world != null/.test(lw));
  ok("it serialises with the layer", /world: L\.world,/.test(src));
  ok("...and is validated on the way back in", /L\.world = r\.world != null \? !!r\.world/.test(src));
  // Only the two Phase A effects offer it, so nothing else grew a control it cannot honour.
  const owners = [...src.matchAll(/\{ id: "([a-z0-9]+)"[\s\S]*?params: \[([^\]]*)\]/g)]
    .filter(m => m[2].indexOf('"world"') >= 0).map(m => m[1]);
  // Hard-coded, like singleprobe's set: the danger is not that this stops working, it is
  // that an INTERIOR FLIGHT is added to it -- Mandelbulb, Menger sponge or Doughnut have
  // the camera inside their own geometry and cannot stand anywhere in a shared world.
  const EXPECT = ["glass", "ocean", "qjulia", "solids", "vballs"];
  ok("exactly the effects that can share a viewpoint offer the control",
     owners.slice().sort().join(",") === EXPECT.join(","), owners.join(",") || "none");
  for (const flight of ["mandelbulb", "menger", "torus"])
    ok(flight + " cannot join -- it is flown from the inside", owners.indexOf(flight) < 0);
}

console.log("");
console.log(fail ? (fail + " FAILED, " + pass + " passed") : ("all " + pass + " passed"));
process.exit(fail ? 1 : 0);
