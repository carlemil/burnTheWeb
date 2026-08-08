// Headless probe for the spectral-flux beat detector.
// Slices the REAL detector source out of index.html (constants, the `audio`
// object, median(), audioTick()) and runs it against synthetic dB spectra on a
// fake clock — so this exercises the shipped code, not a copy of it.
// Usage: node tools/beatprobe.js index.html
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
// The per-trigger pass needs the four things it reads about the stack. Stubbed to ONE layer
// whose arming and tuning the probe drives directly, so this exercises the real
// rebuildTriggers/audioTick against a controllable scene. tuneEff — the inheritance resolver —
// is sliced from the real source rather than stubbed, because "an untouched slider inherits"
// is precisely what section 8 is testing.
const stubs = `
  const probeArm = {}, probeTune = {};
  const anims = { a: 1, b: 1 };
  let stack = [{ n: 0 }];
  const stackSel = 0;
  const beatOf = (L, id) => probeArm[id];
  const tuneOf = (L, id) => probeTune[id];
`;
const code =
  cut("const CONFIG =", "// ==== end CONFIG ====") +   // HOP_MS / BEAT_DEFAULTS source from CONFIG now
  stubs +
  cut("const HOP_MS", "const meterBars") +
  cut("function tuneEff(", "// Three L/M/H toggle chips") +
  cut("const medBuf", "function audioMsg") +
  // clearBeats + clearTrigState come along so the probe drains the latches the way frame()
  // does, instead of reaching in and clearing them itself — otherwise "the latch is cleared"
  // is a property of the probe rather than of the app, and a detector that never released a
  // beat would sail through.
  cut("function audioTick", "function updateMeter") +
  "\nreturn { audio, audioTick, clearBeats, clearTrigState, HOP_MS, WARMUP, beatCfg, BEAT_DEFAULTS, tuneEff," +
  "  probeArm, probeTune, trigState, trigFor, setStack: n => { stack = n; }," +
  "  dirty: () => { trigDirty = true; } };";
const { audio, audioTick, clearBeats, clearTrigState, HOP_MS, WARMUP, beatCfg, BEAT_DEFAULTS, tuneEff,
        probeArm, probeTune, trigState, trigFor, dirty } = new Function("dbg", code)({ on: false });
const resetBeatCfg = () => {   // restore shipped detector thresholds between scenes
  beatCfg.fluxK = BEAT_DEFAULTS.fluxK.slice();
  beatCfg.floor = BEAT_DEFAULTS.floor;
  beatCfg.refract = BEAT_DEFAULTS.refract.slice();
  beatCfg.bands = BEAT_DEFAULTS.bands.map(b => b.slice());
};

// --- stub analyser: 2048-point FFT @48kHz -> 1024 bins of 23.4Hz ---
const BINS = 1024, HZ = 48000 / 2048;
const spec = new Float32Array(BINS);              // dB; the scene rewrites it each tick
audio.analyser = { minDecibels: -95, maxDecibels: -10, getFloatFrequencyData: a => a.set(spec) };
audio.db = new Float32Array(BINS);
audio.mag = new Float32Array(BINS);
audio.prev = new Float32Array(BINS);
const R = (f0, f1) => [Math.max(1, Math.round(f0 / HZ)), Math.min(BINS - 1, Math.round(f1 / HZ))];
audio.bins = [R(30, 150), R(150, 2500), R(2500, 12000)];   // must mirror computeBins()

const WARM_MS = WARMUP * HOP_MS;                  // no beat can fire before this
const TAIL = 300;                                 // let the last hit's peak be picked
// beats inside the measured window (+ the one hop of peak-picking latency)
const inWin = (beats, ms) => beats.filter(t => t <= ms + 60);

// Wipe the per-trigger clocks and latches between scenes — the REAL clearTrigState, which is
// what mute and stopAudio call.
function resetTrigs() { clearTrigState(); dirty(); }
// `trigIds` names the sliders whose per-trigger beats to record alongside the scene-wide ones.
function run(scene, ms, trigIds) {
  for (let b = 0; b < 3; b++) {
    audio.hist[b] = new Float32Array(100);
    audio.peak[b] = audio.f1[b] = audio.f2[b] = audio.energy[b] = 0;
    audio.pulse[b] = 0; audio.lastBeat[b] = 0; audio.bpm[b] = 0; audio.beatNow[b] = false;
  }
  audio.hi = 0; audio.warm = 0; audio.tPrev = 0; spec.fill(-95);
  resetTrigs();
  const beats = [[], [], []];
  const trig = {};
  for (const id of trigIds || []) trig[id] = [[], [], []];
  for (let t = 0; t <= ms + TAIL; t += HOP_MS) {
    scene(t);
    audioTick(t);
    for (let b = 0; b < 3; b++) if (audio.beatNow[b]) beats[b].push(t);
    for (const id of trigIds || []) {
      const st = trigState["0/" + id];
      if (!st) continue;
      for (let b = 0; b < 3; b++) if (st.now[b]) trig[id][b].push(t);
    }
    clearBeats();     // exactly what frame() does once updateAnims has read them
  }
  beats.trig = trig;
  return beats;
}
const band = (lo, hi, db) => { const [i0, i1] = R(lo, hi); for (let i = i0; i <= i1; i++) spec[i] = db; };
const hit = (age, peak, floor) => Math.max(floor, peak - (age / 120) * 45);   // fast attack, ~120ms decay
// every onset in [0,ms] that the detector is allowed to catch (i.e. past warmup)
const onsets = (period, ms) => { const o = []; for (let t = period; t <= ms; t += period) if (t > WARM_MS) o.push(t); return o; };

const out = [];
const check = (name, ok, detail) => out.push({ name, ok, detail });

// 1. Kick on a loud sustained bass line — exactly what the old energy detector
//    missed: the sustain held the rolling average high, so the kick never
//    reached avg × 1.4.
{
  const P = 500, MS = 10000;                       // 120 BPM
  const beats = run(t => {
    spec.fill(-95);
    band(30, 150, -28);                            // constant loud bass
    band(150, 2500, -45);
    if (t >= P) band(35, 140, hit(t % P, -14, -28));
  }, MS);
  const want = onsets(P, MS), got = inWin(beats[0], MS);
  const lat = got.map(g => g - want.reduce((a, b) => Math.abs(b - g) < Math.abs(a - g) ? b : a, want[0]));
  check("kick over sustained bass: all " + want.length + " detected", got.length === want.length, got.length + " beats");
  check("kick timing within 40ms of the onset", Math.max(...lat.map(Math.abs)) <= 40,
    "max |latency| " + Math.max(...lat.map(Math.abs)) + "ms");
}
// 2. Steady loud tone, no transients -> no beats.
{
  const beats = run(() => { spec.fill(-95); band(30, 150, -25); band(150, 2500, -30); }, 5000);
  check("sustained tone, no attacks: no beats", beats[0].length === 0 && beats[1].length === 0,
    JSON.stringify(beats.map(b => b.length)));
}
// 3. Silence -> no beats.
{
  const beats = run(() => spec.fill(-95), 3000);
  check("silence: no beats", beats.every(b => !b.length), JSON.stringify(beats.map(b => b.length)));
}
// 4. Hi-hats on 8ths -> detected in the high band, and no leak into the low band.
{
  const P = 250, MS = 6000;
  const beats = run(t => {
    spec.fill(-95);
    band(150, 2500, -50);
    if (t >= P) band(3000, 11000, hit(t % P, -30, -70));
  }, MS);
  const want = onsets(P, MS);
  const got = inWin(beats[2], MS);
  check("hi-hats on 8ths: all " + want.length + " detected", got.length === want.length, got.length + " beats");
  check("hi-hats don't leak into the low band", beats[0].length === 0, beats[0].length + " low beats");
}
// 5. Quiet verse 20dB down: the adaptive threshold must follow the mix down.
{
  const P = 500, MS = 12000;
  const beats = run(t => {
    spec.fill(-95);
    const d = t > 6000 ? -20 : 0;
    band(30, 150, -30 + d);
    if (t >= P) band(35, 140, hit(t % P, -14 + d, -30 + d));
  }, MS);
  const late = inWin(beats[0], MS).filter(t => t > 6500).length, want = 11;   // 7.0s..12.0s
  check("quiet verse (-20dB): kicks still detected", late >= want - 1, late + " of " + want);
}
// 6. Double-time fill 90ms apart: the refractory must collapse them, not machine-gun.
{
  const beats = run(t => {
    spec.fill(-95); band(30, 150, -40);
    if (t >= 90) band(35, 140, hit(t % 90, -16, -40));
  }, 3000);
  const gaps = beats[0].slice(1).map((t, i) => t - beats[0][i]);
  check("refractory: no two low beats closer than 110ms", gaps.every(g => g >= 110),
    "min gap " + (gaps.length ? Math.min(...gaps) : "n/a") + "ms");
}

// 7. Live tuning is wired: audioTick reads beatCfg, not the old consts. A 90ms-spaced
//    fill collapses under the default 110ms refractory but comes through when it's low.
{
  const scene = t => { spec.fill(-95); band(30, 150, -40); if (t >= 90) band(35, 140, hit(t % 90, -16, -40)); };
  resetBeatCfg();                     const dflt = run(scene, 3000)[0].length;   // refract 110ms
  resetBeatCfg(); beatCfg.refract[0] = 20; const loose = run(scene, 3000)[0].length;
  resetBeatCfg();
  check("beatCfg wired: lower refractory detects more low beats", loose > dflt, loose + " vs " + dflt + " beats");
}

// 8. PER-SLIDER TUNING. The bug: a slider's Refractory row wrote into the scene-wide
//    beatCfg.refract, so tuning one armed slider retuned every other one on that band.
{
  const P = 90, MS = 3000;                       // a double-time fill: refractory is decisive
  const scene = t => { spec.fill(-95); band(30, 150, -40); if (t >= P) band(35, 140, hit(t % P, -16, -40)); };
  const arm = (...ids) => {
    for (const k in probeArm) delete probeArm[k];
    for (const k in probeTune) delete probeTune[k];
    for (const id of ids) probeArm[id] = { low: true, mid: false, high: false };
    dirty();
  };
  const same = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]);

  // 8a. THE SAFETY PROPERTY: with nothing overridden, a trigger's beats are the scene-wide
  //     ones, tick for tick — not merely the same count. Everything else rests on this,
  //     because it is what makes every scene written before the feature render identically.
  resetBeatCfg(); arm("a", "b");
  let r = run(scene, MS, ["a", "b"]);
  check("no override: the trigger's beats ARE the scene-wide beats, tick for tick",
    same(r.trig.a[0], r[0]) && same(r.trig.b[0], r[0]),
    r.trig.a[0].length + " / " + r.trig.b[0].length + " vs " + r[0].length);
  const baseA = r.trig.a[0].slice(), baseB = r.trig.b[0].slice();

  // 8b. THE REPORTED BUG, both halves. Give slider "a" a long refractory of its own:
  //     "a" must fire strictly less, and "b" must be COMPLETELY unaffected — the second
  //     half is the assertion that would have caught the original.
  resetBeatCfg(); arm("a", "b");
  probeTune.a = { refract: [400, 110, 70] };
  dirty();
  r = run(scene, MS, ["a", "b"]);
  check("a slider's own refractory throttles ITS beats", r.trig.a[0].length < baseA.length,
    r.trig.a[0].length + " vs " + baseA.length);
  check("...and leaves every other armed slider untouched", same(r.trig.b[0], baseB),
    r.trig.b[0].length + " vs " + baseB.length);
  check("...and does not touch the scene-wide detector either", same(r[0], baseB),
    r[0].length + " vs " + baseB.length);
  const gaps = r.trig.a[0].slice(1).map((t, i) => t - r.trig.a[0][i]);
  check("...and the gap it asked for is the gap it gets", gaps.every(g => g >= 400),
    "min gap " + (gaps.length ? Math.min(...gaps) : "n/a") + "ms");

  // Sensitivity and Floor need a scene they can discriminate on, and the fill above is not
  // one. Two properties it lacks, both measured rather than assumed:
  //   * its flux is ZERO on most ticks, so the running median is exactly 0, the adaptive
  //     threshold collapses to 0 and NO fluxK can gate anything. A carrier that rises on
  //     most ticks is what gives the median a value at all.
  //   * every hit is the same height, so no relative floor separates them.
  // It also has to be realistic: against a smooth carrier a clean synthetic hit measures
  // ~57x the median, which is far outside the 0.5–6 the slider can store, so the test would
  // be proving something a user could never do. Tuned to a min flux/median ratio of ~3.7 —
  // between the shipped 2.0 and the slider's max 6.0, so both ends mean something.
  // ONE band() call: at this FFT resolution 35–140Hz and 30–150Hz are the same six bins, so
  // a second call would simply overwrite the first.
  const varied = t => {
    spec.fill(-95);
    const k = Math.round(t / HOP_MS);
    const carrier = -44 + (k % 2) * 2;                          // rises every other tick
    const n = Math.floor(t / 200);
    const h = t >= 200 ? hit(t % 200, n % 2 ? -35 : -39, -95) : -95;   // loud, quiet, loud…
    band(30, 150, Math.max(carrier, h));
  };
  resetBeatCfg(); arm("a", "b");
  const vBase = run(varied, MS, ["a", "b"]);
  const vA = vBase.trig.a[0].slice(), vB = vBase.trig.b[0].slice();
  check("the varied scene gives both loud and quiet hits to discriminate", vA.length >= 8,
    vA.length + " beats");

  // 8c. Sensitivity is per slider too: a high fluxK keeps only the loud hits.
  resetBeatCfg(); arm("a", "b");
  probeTune.a = { fluxK: [6, 2, 2] };              // 6.0 = the slider's max, a value a user can set
  dirty();
  r = run(varied, MS, ["a", "b"]);
  check("a slider's own sensitivity thins ITS beats", r.trig.a[0].length < vA.length,
    r.trig.a[0].length + " vs " + vA.length);
  check("...while its neighbour keeps every beat", same(r.trig.b[0], vB),
    r.trig.b[0].length + " vs " + vB.length);

  // 8d. ...and so is Floor: it gates on the hit's size against the band's recent peak, so a
  //     high one drops the quiet hits and keeps the loud.
  resetBeatCfg(); arm("a", "b");
  probeTune.a = { floor: 0.9 };
  dirty();
  r = run(varied, MS, ["a", "b"]);
  check("a slider's own floor thins ITS beats", r.trig.a[0].length < vA.length,
    r.trig.a[0].length + " vs " + vA.length);
  check("...while its neighbour keeps every beat", same(r.trig.b[0], vB),
    r.trig.b[0].length + " vs " + vB.length);

  // 8e. Clearing the override returns it EXACTLY to the inherited sequence — the ↺ path.
  resetBeatCfg(); arm("a", "b");
  delete probeTune.a; dirty();
  r = run(scene, MS, ["a", "b"]);
  check("clearing the override restores the global sequence exactly", same(r.trig.a[0], baseA),
    r.trig.a[0].length + " vs " + baseA.length);

  // 8f. Inheritance is per FIELD, not all-or-nothing: overriding refract must leave
  //     fluxK and floor following the global box.
  resetBeatCfg();
  const eff = tuneEff({ refract: [400, 110, 70] });
  check("an override inherits the fields it does not name",
    eff.fluxK === beatCfg.fluxK && eff.floor === beatCfg.floor && eff.refract[0] === 400,
    "fluxK " + eff.fluxK[0] + " floor " + eff.floor + " refract " + eff.refract[0]);
  check("no tuning at all resolves to the global box", (() => {
    const e = tuneEff(null);
    return e.fluxK === beatCfg.fluxK && e.floor === beatCfg.floor && e.refract === beatCfg.refract;
  })(), "inherits all three");

  // 8g. Two layers arming the same key are DIFFERENT triggers — the identity is
  //     (slot, key), so one layer's refractory cannot reach the other's.
  check("a trigger is keyed by layer slot as well as control",
    trigFor(0, "a") !== trigFor(1, "a"), "distinct records");

  for (const k in probeArm) delete probeArm[k];
  for (const k in probeTune) delete probeTune[k];
  dirty(); resetBeatCfg();
}

let bad = 0;
for (const r of out) { if (!r.ok) bad++; console.log((r.ok ? "PASS  " : "FAIL  ") + r.name + "  [" + r.detail + "]"); }
console.log(bad ? "\n" + bad + " FAILED" : "\nall " + out.length + " passed");
process.exit(bad ? 1 : 0);
