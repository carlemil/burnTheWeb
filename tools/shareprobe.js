// Headless probe for the share-link payload codec.
// Slices the REAL codec + rounding helpers out of index.html and round-trips them,
// so this tests the shipped code rather than a copy. Node 18+ has CompressionStream.
// Usage: node tools/shareprobe.js index.html
//
// It slices by source markers, so keep them: `// ---- share payload codec` …
// `// Build the share URL for the current scene`.
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

// The codec only needs browser globals Node already has (CompressionStream, Response,
// Blob, TextEncoder, atob/btoa). The rounding half needs CONTROLS for its `step` map
// and el() for the live bounds — stub el() with the shipped min/max per key.
const CONTROLS_SRC = cut("  const CONTROLS = [", "  function ctlHTML(");
const bounds = {};
for (const m of CONTROLS_SRC.matchAll(/\{ key: "([a-z]+)",[^}]*?min: (-?[\d.]+), max: (-?[\d.]+)/g))
  bounds[m[1]] = { min: m[2], max: m[3] };

const code =
  "const el = id => { const k = id.replace(/-(lo|hi)$/, ''); return BOUNDS[k] || null; };\n" +
  CONTROLS_SRC +                     // the slice already carries its closing `];`
  cut("  // ---- share payload codec", "  // Build the share URL for the current scene") +
  "\nreturn { zipToB64, unzipFromB64, b64urlIn, b64urlOut, roundShared, roundMap, CTL_STEP };";
const S = new Function("BOUNDS", code)(bounds);

let pass = 0, fail = 0;
const ok = (cond, name, detail) => {
  (cond ? pass++ : fail++);
  console.log((cond ? "PASS  " : "FAIL  ") + name + (detail ? "  [" + detail + "]" : ""));
};

(async () => {
  // --- 1. round-trip -----------------------------------------------------------
  const blob = {
    states: { sirpinfyer: { points: 3850, speed: [92, 92], zoom: [1, 1.65] },
              animejulia: { rpm: [0.28, 0.81], inrad: [0.03, 0.1] } },
    beats: {}, pulses: {}, plens: {}, extras: { sirpinfyer: { palette: "7", filters: ["fire", "bloom"] } },
    effect: "animejulia", cam: { zoom: [1, 1], camrx: [0, 0] }, cycle: true, ttl: [10, 30], ranges: {},
  };
  const json = JSON.stringify(blob);
  const z = await S.zipToB64(json);
  ok(typeof z === "string" && z.length > 0, "encodes to a payload", z && z.length + " chars");
  ok(!/[+/=]/.test(z), "payload is base64url (no + / =) so it survives a URL unescaped");
  const back = await S.unzipFromB64(z);
  ok(back === json, "decodes byte-for-byte back to the same JSON");
  ok(JSON.stringify(JSON.parse(back)) === json, "...and reparses to the same object");

  // --- 2. it is actually much smaller ------------------------------------------
  const b64 = Buffer.from(json, "utf8").toString("base64");
  ok(z.length < b64.length * 0.75, "materially smaller than plain base64",
     b64.length + " -> " + z.length + " (" + (100 - z.length / b64.length * 100).toFixed(0) + "% off)");

  // A realistic full-size blob is where it matters — the payload that broke TinyURL.
  const big = { states: {}, beats: {}, pulses: {}, plens: {}, extras: {}, effect: "plasma",
                cam: { zoom: [1, 1], camrx: [0, 0], camry: [0, 0], camrz: [0, 0] },
                cycle: true, ttl: [10, 30], ranges: {} };
  for (let i = 0; i < 16; i++) {
    const st = {};
    for (const k of Object.keys(bounds).slice(0, 20)) st[k] = [0.3456789012345678, 1.2345678901234567];
    big.states["fx" + i] = st;
    big.extras["fx" + i] = { palette: "5", morph: true, showBox: true, randSeed: true, filters: ["fire", "bloom"] };
  }
  const bigJson = JSON.stringify(big);
  const bigZ = await S.zipToB64(bigJson);
  ok(bigZ.length < 3000, "a full 16-effect scene fits well inside TinyURL's limit",
     Buffer.from(bigJson).toString("base64").length + " -> " + bigZ.length + " chars");

  // --- 3. base64url translation ------------------------------------------------
  // Use genuine base64 (length is always a multiple of 4) — the round trip only has
  // to hold for what btoa actually emits.
  const raw = Buffer.from([251, 239, 190, 0, 16]).toString("base64");   // contains + and /
  ok(/[+/]/.test(raw) && S.b64urlIn(S.b64urlOut(raw)) === raw,
     "base64url survives a round trip", raw + " -> " + S.b64urlOut(raw));
  ok(S.b64urlIn("AAAA") === "AAAA", "already-padded input is left alone");
  ok(S.b64urlIn("AAA") === "AAA=", "missing padding is restored");

  // --- 4. rounding: shrinks, stays in bounds, respects each control's step -------
  ok(S.roundShared("fade", 0.9412345678901234) === 0.941, "rounds to the control's step (fade: 0.001)");
  ok(S.roundShared("points", 3849.9999999) === 3850, "integral controls stay integral");
  // fade's max is 0.995 — rounding up must not push past it, or applyBlob's ok()
  // would hard-reject the value and silently fall back to the seeded default.
  const hi = S.roundShared("fade", 0.9999);
  ok(hi <= 0.995, "rounding clamps to the control's max rather than overshooting", "got " + hi);
  const lo = S.roundShared("fade", 0.0001);
  ok(lo >= 0.5, "...and to its min", "got " + lo);
  ok(S.roundShared("nosuchkey", 1.23456789) === 1.235, "unknown keys fall back to 3 decimals");

  const messy = { speed: [92.00000000000001, 91.99999999999999], zoom: [1.6500000000000001, 1] };
  const tidy = S.roundMap(messy);
  ok(JSON.stringify(tidy).length < JSON.stringify(messy).length, "rounding shrinks the payload",
     JSON.stringify(messy).length + " -> " + JSON.stringify(tidy).length);
  ok(tidy.speed[0] === 92 && tidy.zoom[0] === 1.65, "...without changing the value anyone can see",
     JSON.stringify(tidy));

  // --- 5. corrupt input is refused, not thrown ---------------------------------
  ok((await S.unzipFromB64("not-a-real-payload")) === null, "garbage decodes to null, no throw");
  ok((await S.unzipFromB64("")) === null, "empty payload decodes to null");

  console.log("\n" + (fail ? fail + " FAILED, " : "") + "all " + pass + " passed");
  process.exit(fail ? 1 : 0);
})();
