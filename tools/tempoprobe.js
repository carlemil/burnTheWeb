// tempoprobe.js — the TEMPO TRACKER: continuous period + phase, so a beat is known BEFORE it
// lands. Slices the real detector out of the built file and runs it against synthetic dB
// spectra on a fake clock, exactly as beatprobe does — this exercises the shipped tracker,
// not a copy of it.
//
// The onset detector is reactive by construction and beatprobe already covers it. What is
// checked here is everything that only a PREDICTIVE system can get wrong: locking to the
// right tempo (not half or double it), putting the grid in the right PHASE, refusing to
// invent a grid when there is no tempo, and — the one that protects every existing scene —
// leaving the reactive path untouched tick for tick when the tempo features are off.
//
// Usage: node tools/tempoprobe.js dev-index.html
const fs = require("fs");
const html = fs.readFileSync(process.argv[2] || "dev-index.html", "utf8");
const s0 = html.indexOf("<script>"), s1 = html.indexOf("</script>", s0);
if (s0 < 0 || s1 < 0) throw new Error("probe: no inline <script> found");
const src = html.slice(s0 + 8, s1);

const cut = (from, to) => {
  const a = src.indexOf(from), b = src.indexOf(to);
  if (a < 0 || b < 0 || b < a) throw new Error("probe: could not slice " + from + " .. " + to);
  return src.slice(a, b);
};
const stubs = `
  const probeArm = {}, probeTune = {};
  const anims = { a: 1, b: 1, c: 1 };   // 'c' exercises lead; rebuildTriggers iterates these
  let stack = [{ n: 0 }];
  const stackSel = 0;
  const beatOf = (L, id) => probeArm[id];
  const tuneOf = (L, id) => probeTune[id];
`;
const code =
  cut("const CONFIG =", "// ==== end CONFIG ====") +
  stubs +
  cut("const HOP_MS", "const meterBars") +
  cut("function tuneEff(", "// Three L/M/H toggle chips") +
  cut("const medBuf", "function audioMsg") +
  cut("function audioTick", "function updateMeter") +
  "\nreturn { audio, audioTick, clearBeats, clearTrigState, HOP_MS, WARMUP, beatCfg, BEAT_DEFAULTS," +
  "  tuneEff, probeArm, probeTune, trigState, beatEta, beatPhaseAt, tempoLocked, tempoReset," +
  "  CONF_MIN, dirty: () => { trigDirty = true; } };";
const A = new Function("dbg", code)({ on: false });
const { audio, audioTick, clearBeats, clearTrigState, HOP_MS, WARMUP, beatCfg, BEAT_DEFAULTS,
        probeArm, probeTune, trigState, beatEta, beatPhaseAt, tempoLocked, CONF_MIN, dirty } = A;

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  // The swapped-argument trap: a name is always truthy, so ok(cond, name) passes everything.
  if (typeof name !== "string") { console.log("FAIL  probe bug: ok() called with a non-string name"); fail++; return; }
  if (cond) { pass++; console.log("PASS  " + name + (detail ? "  [" + detail + "]" : "")); }
  else { console.log("FAIL  " + name + (detail ? "  [" + detail + "]" : "")); fail++; }
}

// --- stub analyser: 2048-point FFT @48kHz -> 1024 bins of 23.4Hz ---
const BINS = 1024, HZ = 48000 / 2048;
const spec = new Float32Array(BINS);
audio.analyser = { minDecibels: -95, maxDecibels: -10, getFloatFrequencyData: a => a.set(spec) };
audio.db = new Float32Array(BINS);
audio.mag = new Float32Array(BINS);
audio.prev = new Float32Array(BINS);
const R = (f0, f1) => [Math.max(1, Math.round(f0 / HZ)), Math.min(BINS - 1, Math.round(f1 / HZ))];
audio.bins = [R(30, 150), R(150, 2500), R(2500, 12000)];
const band = (lo, hi, db) => { const [i0, i1] = R(lo, hi); for (let i = i0; i <= i1; i++) spec[i] = db; };
const hitEnv = (age, peak, floor) => Math.max(floor, peak - (age / 120) * 45);
const WARM_MS = WARMUP * HOP_MS;

const resetBeatCfg = () => {
  beatCfg.fluxK = BEAT_DEFAULTS.fluxK.slice();
  beatCfg.floor = BEAT_DEFAULTS.floor;
  beatCfg.refract = BEAT_DEFAULTS.refract.slice();
  beatCfg.bands = BEAT_DEFAULTS.bands.map(b => b.slice());
  beatCfg.lead = BEAT_DEFAULTS.lead; beatCfg.lock = BEAT_DEFAULTS.lock;
};

// Run a scene, sampling the tracker each tick. `probe` is called with (t) after audioTick so a
// test can record predictions AS THEY WOULD BE USED, not after the fact.
function run(scene, ms, probe, trigIds) {
  for (let b = 0; b < 3; b++) {
    audio.hist[b] = new Float32Array(100);
    audio.peak[b] = audio.f1[b] = audio.f2[b] = audio.energy[b] = 0;
    audio.pulse[b] = 0; audio.lastBeat[b] = 0; audio.bpm[b] = 0; audio.beatNow[b] = false;
  }
  audio.hi = 0; audio.warm = 0; audio.tPrev = 0; spec.fill(-95);
  A.tempoReset();
  clearTrigState(); dirty();
  const trig = {};
  for (const id of trigIds || []) trig[id] = [[], [], []];
  for (let t = 0; t <= ms; t += HOP_MS) {
    scene(t);
    audioTick(t);
    for (const id of trigIds || []) {
      const st = trigState["0/" + id];
      if (st) for (let b = 0; b < 3; b++) if (st.now[b]) trig[id][b].push(t);
    }
    if (probe) probe(t);
    clearBeats();
  }
  return trig;
}
// A four-on-the-floor kick at `period` ms.
const kickScene = period => t => {
  spec.fill(-95);
  band(30, 150, -30);
  band(150, 2500, -50);
  if (t >= period) band(35, 140, hitEnv(t % period, -14, -30));
};

console.log("--- 1. LOCK: does it find the tempo at all? ---");
{
  const P = 500;                                   // 120 BPM
  run(kickScene(P), 20000);
  const T = audio.tempo;
  ok("120 BPM kick: period converges to 500ms", Math.abs(T.period - P) <= 10, "period " + T.period.toFixed(1) + "ms");
  ok("...and the reported BPM is ~120", Math.abs(T.bpm - 120) <= 3, "bpm " + T.bpm.toFixed(1));
  ok("...with usable confidence", T.conf >= CONF_MIN, "conf " + T.conf.toFixed(2));
}

{
  // SUB-LAG PRECISION. The lag grid is 10ms, and a real tempo does not sit on it. 455ms is
  // deliberately half way between two lags: without the parabolic interpolation around the
  // correlation peak the period can only come back as 450 or 460, and that 5ms error walks
  // the predicted grid off the music whenever there are no onsets to correct it -- which is
  // exactly the situation 'lock' creates. This is the assertion that keeps the interpolation
  // honest; with it removed, the tracker is 5ms out here and everything else still passes.
  const P = 455;
  run(kickScene(P), 24000);
  ok("a tempo BETWEEN two lags is resolved to better than a lag step",
     Math.abs(audio.tempo.period - P) <= 3, "period " + audio.tempo.period.toFixed(1) + "ms (lag grid is 10ms)");
}

console.log("--- 2. PHASE: the claim the whole feature rests on ---");
{
  // THIS is what nothing in the app could assert before: not "a beat happened" but "the next
  // one lands at T". Sample the prediction every tick during the last third of the run and
  // measure it against the kicks that actually arrive.
  const P = 500, MS = 24000;
  const errs = [];
  run(kickScene(P), MS, t => {
    if (t < MS * 0.6 || !tempoLocked()) return;
    const eta = beatEta(t);
    if (eta < 0) return;
    const predicted = t + eta;
    const truth = Math.round(predicted / P) * P;   // the kick nearest that prediction
    errs.push(predicted - truth);
  });
  const worst = errs.length ? Math.max(...errs.map(Math.abs)) : 1e9;
  ok("predicted beat times land within 20ms of the real kicks", errs.length > 100 && worst <= 20,
     errs.length + " predictions, worst " + worst.toFixed(1) + "ms");
  // Phase must sweep the whole 0..1 range: a tracker stuck at one phase would also pass a
  // loose timing test.
  const qs = [];
  run(kickScene(P), MS, t => { const q = beatPhaseAt(t); if (q >= 0) qs.push(q); });
  ok("beatPhaseAt sweeps the full 0..1 approach", qs.length > 100 && Math.min(...qs) < 0.1 && Math.max(...qs) > 0.9,
     "min " + Math.min(...qs).toFixed(2) + " max " + Math.max(...qs).toFixed(2));
}

console.log("--- 3. THE OCTAVE TRAP: the most likely way this ships wrong ---");
{
  // Hats on the 8ths over a four-on-the-floor kick. The onset envelope has energy at BOTH the
  // beat and the half-beat, and a plain autocorrelation is equally happy locking to either --
  // a visual pulsing at double speed. The bias plus the explicit half/double re-test is what
  // has to save it.
  const P = 500, MS = 24000;
  run(t => {
    spec.fill(-95);
    band(30, 150, -30); band(150, 2500, -50);
    if (t >= P) band(35, 140, hitEnv(t % P, -14, -30));
    if (t >= P / 2) band(6000, 11000, hitEnv((t + P / 2) % (P / 2), -20, -60));
  }, MS);
  const T = audio.tempo;
  ok("kick + offbeat hats: locks to the KICK, not double tempo",
     Math.abs(T.period - P) <= 25, "period " + T.period.toFixed(1) + "ms (double would be ~250)");
}
{
  // And the other direction: a genuinely fast pattern must not be halved into a comfortable
  // ~120. The bias has to be a tie-breaker, not an override.
  const P = 340, MS = 24000;                       // ~176 BPM
  run(kickScene(P), MS);
  const T = audio.tempo;
  ok("a genuinely fast 176 BPM is not halved to fit the bias",
     Math.abs(T.period - P) <= 25, "period " + T.period.toFixed(1) + "ms (halved would be ~680)");
}

console.log("--- 4. RE-LOCK: the tempo changes under it ---");
{
  const P1 = 500, P2 = 429, SWITCH = 20000, MS = 46000;   // 120 -> 140 BPM
  let atSwitch = 0;
  run(t => {
    const P = t < SWITCH ? P1 : P2;
    const base = t < SWITCH ? 0 : SWITCH;
    spec.fill(-95);
    band(30, 150, -30); band(150, 2500, -50);
    if (t >= P) band(35, 140, hitEnv((t - base) % P, -14, -30));
  }, MS, t => { if (t === SWITCH) atSwitch = audio.tempo.period; });
  ok("was locked to 120 before the change", Math.abs(atSwitch - P1) <= 15, "period " + atSwitch.toFixed(1));
  ok("re-locks to 140 BPM after it", Math.abs(audio.tempo.period - P2) <= 20, "period " + audio.tempo.period.toFixed(1));
}

console.log("--- 5. CONFIDENCE: it must refuse to invent a grid ---");
{
  // Silence.
  run(t => { spec.fill(-95); }, 20000);
  ok("silence never reads as a tempo", !tempoLocked(), "conf " + audio.tempo.conf.toFixed(2));
  // Broadband noise with no periodicity, redrawn every tick.
  let seed = 12345;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  run(t => { spec.fill(-95); for (let i = 1; i < BINS; i += 7) spec[i] = -80 + rnd() * 45; }, 20000);
  ok("unstructured noise never reads as a tempo", !tempoLocked(), "conf " + audio.tempo.conf.toFixed(2));
  // Onsets at random intervals — energy, but no period to find.
  seed = 999;
  const times = []; for (let t = 1000, i = 0; t < 20000; t += 220 + rnd() * 900, i++) times.push(t);
  run(t => {
    spec.fill(-95); band(30, 150, -30); band(150, 2500, -50);
    const last = times.filter(x => x <= t).pop();
    if (last !== undefined) band(35, 140, hitEnv(t - last, -14, -30));
  }, 20000);
  ok("free-tempo onsets never read as a tempo", !tempoLocked(), "conf " + audio.tempo.conf.toFixed(2));
  ok("...and an unlocked tracker returns -1, not a plausible number",
     beatEta(1234) === -1 && beatPhaseAt(1234) === -1);
}

console.log("--- 6. THE ADDITIVE SAFETY PROPERTY ---");
{
  // With lead 0 and lock false — the shipped defaults — a trigger's beats must be IDENTICAL,
  // tick for tick, to what the reactive detector alone produces. This is what guarantees every
  // scene saved before the tracker existed animates exactly as it did. Compared as sequences,
  // not counts: one beat displaced by a tick is exactly the regression this must catch.
  resetBeatCfg();
  probeArm.a = { low: true, mid: false, high: false };
  probeTune.a = null;                              // inherit everything
  const P = 500, MS = 20000;
  const r1 = run(kickScene(P), MS, null, ["a"]);
  const withTracker = r1.a[0].slice();
  // Now the same scene with the tracker's grid deliberately made useless, so the reactive path
  // is provably the only thing that can have fired.
  const r2 = run(t => { kickScene(P)(t); A.tempoReset(); }, MS, null, ["a"]);
  const reactiveOnly = r2.a[0].slice();
  ok("lead 0 / lock false: beats are tick-for-tick the reactive ones",
     withTracker.length > 10 && withTracker.join(",") === reactiveOnly.join(","),
     withTracker.length + " beats");
}
{
  // And the opposite: turning lock ON must actually change something, or the previous
  // assertion is passing because the feature does nothing at all.
  resetBeatCfg();
  probeArm.b = { low: true, mid: false, high: false };
  probeTune.b = { lock: true };
  dirty();
  const P = 500, MS = 24000;
  // A pattern with a hole in it: four bars of kick, then two bars of silence. The reactive
  // detector goes quiet through the hole; a tempo-locked trigger keeps the grid running.
  const holed = t => {
    spec.fill(-95); band(30, 150, -30); band(150, 2500, -50);
    const inHole = t > 14000 && t < 18000;
    if (t >= P && !inHole) band(35, 140, hitEnv(t % P, -14, -30));
  };
  const r = run(holed, MS, null, ["b"]);
  const inHole = r.b[0].filter(t => t > 14200 && t < 17800);
  ok("lock ON fills beats through a hole the onset detector cannot see",
     inHole.length >= 5, inHole.length + " filled beats in the 4s hole");
}
{
  // GRID DRIFT THROUGH A HOLE -- the property sub-lag precision actually buys, and the reason
  // the period is interpolated rather than rounded to the 10ms lag grid. While onsets keep
  // arriving the PLL hides a small period error by correcting the phase every beat; through a
  // silence there is nothing to correct against, so the error integrates. A 455ms tempo
  // rounded to 460 walks 5ms per beat, which is ~65ms by the end of a six-second hole.
  resetBeatCfg();
  probeArm.b = { low: true, mid: false, high: false };
  probeTune.b = { lock: true };
  dirty();
  const P = 455, MS = 30000, H0 = 16000, H1 = 22000;
  const r = run(t => {
    spec.fill(-95); band(30, 150, -30); band(150, 2500, -50);
    const inHole = t > H0 && t < H1;
    if (t >= P && !inHole) band(35, 140, hitEnv(t % P, -14, -30));
  }, MS, null, ["b"]);
  // How far each filled beat sits from the kick that would have been there.
  const off = r.b[0].filter(t => t > H0 + 300 && t < H1).map(t => {
    const d = t - Math.round(t / P) * P;
    return d;
  });
  const drift = off.length >= 4 ? Math.abs(off[off.length - 1] - off[0]) : -1;
  ok("a locked grid does not walk off the beat through a 6s hole",
     off.length >= 4 && drift <= 30, off.length + " filled beats, drift " + drift.toFixed(0) + "ms");
}
{
  // Lead must fire EARLY, and by about the amount asked for.
  resetBeatCfg();
  probeArm.c = { low: true, mid: false, high: false };
  probeTune.c = { lead: 120 };
  dirty();
  const P = 500, MS = 24000;
  const r = run(kickScene(P), MS, null, ["c"]);
  const late = r.c[0].filter(t => t > 16000);
  // Distance from each fire to the NEXT real kick.
  const early = late.map(t => (Math.ceil(t / P) * P) - t);
  const med = early.sort((a, b) => a - b)[early.length >> 1];
  ok("lead 120ms fires ahead of the beat by about that much",
     early.length > 5 && Math.abs(med - 120) <= 35, "median lead " + med + "ms");
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
