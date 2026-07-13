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
const code =
  cut("const HOP_MS", "const meterBars") +
  cut("const medBuf", "function audioMsg") +
  cut("function audioTick", "function clearBeats") +
  "\nreturn { audio, audioTick, HOP_MS, WARMUP };";
const { audio, audioTick, HOP_MS, WARMUP } = new Function("dbg", code)({ on: false });

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

function run(scene, ms) {
  for (let b = 0; b < 3; b++) {
    audio.hist[b] = new Float32Array(100);
    audio.peak[b] = audio.f1[b] = audio.f2[b] = audio.energy[b] = 0;
    audio.pulse[b] = 0; audio.lastBeat[b] = 0; audio.bpm[b] = 0; audio.beatNow[b] = false;
  }
  audio.hi = 0; audio.warm = 0; audio.tPrev = 0; spec.fill(-95);
  const beats = [[], [], []];
  for (let t = 0; t <= ms + TAIL; t += HOP_MS) {
    scene(t);
    audioTick(t);
    for (let b = 0; b < 3; b++) if (audio.beatNow[b]) { beats[b].push(t); audio.beatNow[b] = false; }
  }
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

let bad = 0;
for (const r of out) { if (!r.ok) bad++; console.log((r.ok ? "PASS  " : "FAIL  ") + r.name + "  [" + r.detail + "]"); }
console.log(bad ? "\n" + bad + " FAILED" : "\nall " + out.length + " passed");
process.exit(bad ? 1 : 0);
