// asciiprobe.js — the ASCII mosaic's GLYPH RAMP.
//
// What this pins is the half a screenshot cannot judge. The filter looks plausible whatever
// the ramp does: a mis-sorted atlas, a level pointing at the wrong run of glyphs, or a set
// quietly truncated to its first 255 characters all still render "some text over the picture".
// The properties that actually make it a dither are structural, so they are checked here.
//
// Markers (keep them):
//   function chRange(              …  function buildAsciiAtlas(     -- the sets + pickChars
//   // GROUP THE RAMP INTO LEVELS  …  const px = oc.getImageData     -- the bucket packing
const fs = require("fs");
const src = fs.readFileSync(process.argv[2] || "dev-index.html", "utf8");

let pass = 0, fail = 0;
function ok(name, cond) {
  // The swapped-argument trap recorded in CLAUDE.md: a name is always truthy, so ok(cond, name)
  // passes every assertion. Hard-fail rather than report a green line that means nothing.
  if (typeof name !== "string") { console.log("FAIL  probe bug: ok() called with a non-string name"); fail++; return; }
  if (cond) { pass++; } else { console.log("FAIL  " + name); fail++; }
}

function slice(a, b) {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  if (i < 0 || j < 0) { console.log("FAIL  marker missing: " + a); fail++; return ""; }
  return src.slice(i, j);
}

// ---- the sets and the sampler -------------------------------------------------------------
const setsSrc = slice("function chRange(", "function buildAsciiAtlas(");
// Strict mode keeps a plain eval's declarations to itself (the tintprobe lesson), so hand the
// slice back out of a Function instead.
const SETS = new Function(setsSrc + "; return { chRange, ASCII_SETS, pickChars };")();

ok("eight scripts, Mixed last", SETS.ASCII_SETS.length === 8 && SETS.ASCII_SETS[7].name === "Mixed");

const names = SETS.ASCII_SETS.map(s => s.name);
ok("the control's enum names every set it can hold",
   names.every(n => src.includes('"' + n + '"')) && /max: 7,[^}]*ascset|ascset[^}]*max: 7/.test(src.replace(/\n/g, " ")));

// EVERY SET MUST BE BIG. The whole point of the rewrite: seven glyphs cannot carry a gradient.
SETS.ASCII_SETS.forEach(s => {
  const n = [...new Set([...s.chars()])].length;
  ok(s.name + ": at least 64 distinct candidates (has " + n + ")", n >= 64);
});

// Mixed must actually be a mixture, not a re-run of one script.
const mixed = SETS.ASCII_SETS[7].chars();
ok("Mixed draws from every other set",
   SETS.ASCII_SETS.slice(0, 7).every(s => [...s.chars()].some(c => mixed.includes(c))));

// pickChars: dedupe, drop spaces (cell 0 is the blank), respect the cap, and SPREAD rather
// than truncate -- truncating Blocks would keep the shade squares and lose all box-drawing.
const dup = SETS.pickChars("aabbcc  dd", 100);
ok("pickChars dedupes and drops spaces", dup.join("") === "abcd");

const wide = SETS.pickChars(SETS.chRange(0x41, 0x41 + 199), 50);
ok("pickChars honours the cap", wide.length === 50);
ok("pickChars samples ACROSS the set, never the first N",
   wide[wide.length - 1].codePointAt(0) > 0x41 + 150);
ok("pickChars keeps sample order ascending",
   wide.every((c, i) => i === 0 || c.codePointAt(0) > wide[i - 1].codePointAt(0)));

// ---- the bucket packing --------------------------------------------------------------------
// The run inside buildAsciiAtlas0, exercised directly against synthetic coverages.
// Sliced to the statement that follows it, so the extract is exactly the packing code and
// nothing has to be guessed about braces.
const body = slice("// GROUP THE RAMP INTO LEVELS", "const px = oc.getImageData");

function packBuckets(cov, keep, LEVELS) {
  const asciiBuckets = new Float32Array(LEVELS * 2);
  const ASCII_LEVELS = LEVELS;
  new Function("cov", "keep", "asciiBuckets", "ASCII_LEVELS", body)(cov, keep, asciiBuckets, LEVELS);
  return asciiBuckets;
}

function checkTable(label, cov, keep, LEVELS = 64) {
  const b = packBuckets(cov, keep, LEVELS);
  const n = keep.length + 1;                       // atlas cells, including the blank at 0
  let counts = 0, holes = 0, oob = 0;
  for (let i = 0; i < LEVELS; i++) {
    const start = b[i * 2], cnt = b[i * 2 + 1];
    if (cnt < 1) holes++;
    if (start < 0 || start + cnt > n) oob++;
    counts += cnt;
  }
  // A ZERO COUNT IS THE BUG THIS EXISTS FOR: the shader does start + floor(r * count), so a
  // count of 0 collapses to glyph 0 -- the blank -- and punches black holes through whatever
  // midtone landed on that level. Every level must name at least one real cell.
  ok(label + ": no level has a zero count", holes === 0);
  ok(label + ": every level stays inside the atlas", oob === 0);
  ok(label + ": the darkest level is the blank cell", b[0] === 0 && b[1] >= 1);
  return b;
}

// A full, evenly spread ramp — the healthy case.
const even = Array.from({ length: 200 }, (_, i) => i / 199);
checkTable("even ramp", even, even.map((_, i) => i));

// CLUSTERED coverages, which is the realistic case: most characters of a script are light and
// only a handful are heavy, so whole levels at the top land empty and must inherit.
const clustered = Array.from({ length: 120 }, (_, i) => (i < 110 ? 0.02 + i * 0.001 : 0.6 + (i - 110) * 0.04));
checkTable("clustered ramp", clustered, clustered.map((_, i) => i));

// The floor: a font that rendered almost nothing.
checkTable("tiny set", [0.1, 0.5, 0.9], [0, 1, 2]);

// MULTIPLE GLYPHS PER LEVEL is the feature — a level holding one lonely character means the
// randomised pick has nothing to choose from and flat areas tile again.
const bEven = packBuckets(even, even.map((_, i) => i), 64);
let multi = 0;
for (let i = 0; i < 64; i++) if (bEven[i * 2 + 1] > 1) multi++;
ok("a full set gives most levels several interchangeable glyphs (" + multi + "/64)", multi >= 48);

// Levels must not run backwards: coverage is sorted, so starts are non-decreasing.
let mono = true;
for (let i = 1; i < 64; i++) if (bEven[i * 2] < bEven[(i - 1) * 2]) mono = false;
ok("levels advance through the sorted atlas", mono);

// ---- the shader's contract ------------------------------------------------------------------
const shader = slice("const FS_ASCII", "`;");
ok("the shader indexes a level, then picks inside it", /uBucket\[lv\]/.test(shader) && /bk\.x \+ floor\(r \* bk\.y\)/.test(shader));
ok("ASC_LEVELS matches the CPU's ASCII_LEVELS",
   /#define ASC_LEVELS 64/.test(shader) && /const ASCII_LEVELS = 64;/.test(src));
// THE GHOST-BALL RULE. This hash decides which character a cell shows; if a driver recompile
// changed it, the text would silently reshuffle. Integer arithmetic is exact everywhere.
ok("the glyph pick uses an INTEGER hash, never fract(sin(...))",
   /uint ascHash\(uvec2/.test(shader) && !/fract\s*\(\s*sin\s*\(/.test(shader.replace(/\/\/[^\n]*/g, "")));
// The heat buffer is already Y-flipped against the screen, so a rising gl_FragCoord.y walks
// DOWN the picture and matches the atlas's own top-down rows. An extra flip here renders every
// glyph upside down -- which shipped, because dithered capitals hide it (M and W swap, and
// A/N/U/O/X/H all still read as letters). Assert the absence.
ok("the atlas is sampled top-down, with NO second Y flip", /uGlyphs\), inCell\.y\)/.test(shader) && !/1\.0 - inCell\.y/.test(shader));

// Per-glyph tofu rejection: a partial font must drop its missing characters, not seat a run of
// identical boxes in the middle of the ramp.
ok("missing glyphs are rejected per glyph, against a known-absent codepoint",
   /ASCII_TOFU/.test(src) && /Math\.abs\(cov\[i\] - tofuCov\) > 1e-9/.test(src));
ok("the strip is capped by the GPU's own texture limit", /MAX_TEXTURE_SIZE/.test(src));

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
