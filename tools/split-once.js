// One-shot bootstrapper: split the monolithic index.html into src/ pieces that
// tools/build.js concatenates back into a byte-identical index.html.
//
// Usage: node tools/split-once.js [index.html]
//
// Safe by construction: it extracts the <style> inner text and the IIFE body,
// asserts that re-inserting them reproduces the input EXACTLY, and only then
// writes src/. The JS body is cut ONLY at the unique section-header markers
// below, snapped to line starts, in original order — so build.js joining the
// slices with '' reproduces the body verbatim. Run once; kept in history after.
"use strict";
const fs = require("fs");
const path = require("path");

const srcFile = process.argv[2] || "index.html";
const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, srcFile), "utf8");

// --- locate the two bodies -------------------------------------------------
const cssStart = html.indexOf("<style>") + "<style>".length;
const cssEnd = html.indexOf("</style>");
if (cssStart < "<style>".length || cssEnd < 0) throw new Error("no <style> block");

const iifeAt = html.indexOf("(() => {");
if (iifeAt < 0) throw new Error("no IIFE");
const useStrict = html.indexOf('"use strict";', iifeAt);
const bodyStart = useStrict + '"use strict";'.length;      // body begins right after it
const scriptClose = html.indexOf("</script>", bodyStart);
const bodyEnd = html.lastIndexOf("})();", scriptClose);    // the IIFE's closing call
if (useStrict < 0 || scriptClose < 0 || bodyEnd < 0) throw new Error("no IIFE body");

const css = html.slice(cssStart, cssEnd);
const jsBody = html.slice(bodyStart, bodyEnd);

// --- template: everything else, with two markers ---------------------------
const template =
  html.slice(0, cssStart) + "{{CSS}}" +
  html.slice(cssEnd, bodyStart) + "{{JS}}" +
  html.slice(bodyEnd);

// --- byte-identity self-check BEFORE writing anything ----------------------
const rebuilt = template.split("{{CSS}}").join(css).split("{{JS}}").join(jsBody);
if (rebuilt !== html) throw new Error("self-check failed: template does not round-trip");

// --- slice the JS body at unique section markers ---------------------------
// Each entry starts a new file. The first starts at body offset 0. Markers are
// snapped back to the start of their line so files begin cleanly.
const SLICES = [
  { file: "00-globals.js",            marker: null },  // canvas + GL globals + initGL
  { file: "10-palette.js",            marker: "// ---- palettes (classic demoscene style) ----" },
  { file: "20-gl-shaders.js",         marker: "//  WebGL2 renderer" },
  { file: "30-gl-pipeline.js",        marker: "// ---- post-FX passes. All RGB" },
  { file: "40-fire-physics.js",       marker: "// ---- Tetrafyer rigid-body physics" },
  { file: "45-animation.js",          marker: "// ---- animation ----" },
  { file: "50-effects-shaders.js",    marker: "// ---- AnimeJulia: animated Julia set" },
  { file: "55-effects-points.js",     marker: "// ---- Geometric shape effects (CPU mirrors" },
  { file: "60-audio.js",              marker: "// ---- controls ----" },
  { file: "65-controls.js",           marker: "// ---- per-effect controls, generated" },
  { file: "70-stack.js",              marker: "// ---- the effect STACK" },
  { file: "74-effects-registry.js",   marker: "// ---- effect registry: the single source" },
  { file: "76-credits.js",            marker: "// ---- Credits ---" },
  { file: "78-filters.js",            marker: "// ---- FILTERS: stackable post-FX" },
  { file: "80-transitions.js",        marker: "// ---- TRANSITIONS: how one preset" },
  { file: "82-stack-lifecycle.js",    marker: "// ---- stack item lifecycle" },
  { file: "84-ranges-tuning.js",      marker: "// ---- custom slider ranges" },
  { file: "86-breakout.js",           marker: "// ---- Break-out boxes" },
  { file: "88-share.js",              marker: "// ---- share payload codec" },
  { file: "90-presets.js",            marker: "// ---- presets: named full-scene" },
  { file: "92-backup-restore.js",     marker: "// ---- Backup: ONE FILE PER PRESET" },
  { file: "94-orbit-editor.js",       marker: "// ---- Orbit editor ---" },
  { file: "96-beat-tuning-ui.js",     marker: "// ---- beat-detection tuning (its own" },
  { file: "98-help-misc.js",          marker: "// ---- help popup: effect-aware" },
];

// resolve each marker to a line-start offset within jsBody
const offsets = SLICES.map((s, i) => {
  if (s.marker === null) return 0;
  const hits = jsBody.split(s.marker).length - 1;
  if (hits !== 1) throw new Error(`marker for ${s.file} appears ${hits}x (need exactly 1): ${s.marker}`);
  const at = jsBody.indexOf(s.marker);
  return jsBody.lastIndexOf("\n", at) + 1;                // snap to line start
});
for (let i = 1; i < offsets.length; i++)
  if (offsets[i] <= offsets[i - 1]) throw new Error(`markers out of order at ${SLICES[i].file}`);

// carve consecutive substrings; concatenation === jsBody by construction
const pieces = SLICES.map((s, i) => ({
  file: s.file,
  text: jsBody.slice(offsets[i], i + 1 < offsets.length ? offsets[i + 1] : jsBody.length),
}));
if (pieces.map(p => p.text).join("") !== jsBody) throw new Error("slice concat != body");

// --- write src/ ------------------------------------------------------------
const srcDir = path.join(root, "src");
fs.mkdirSync(srcDir, { recursive: true });
fs.writeFileSync(path.join(srcDir, "styles.css"), css);
fs.writeFileSync(path.join(srcDir, "index.template.html"), template);
fs.writeFileSync(path.join(srcDir, "manifest.txt"),
  "# ordered list of JS slices concatenated (verbatim) into the IIFE body by tools/build.js\n" +
  pieces.map(p => p.file).join("\n") + "\n");
for (const p of pieces) fs.writeFileSync(path.join(srcDir, p.file), p.text);

console.log(`wrote src/styles.css (${css.length}b), src/index.template.html, ${pieces.length} JS slices:`);
for (const p of pieces) console.log(`  ${p.file.padEnd(24)} ${p.text.length}b`);
