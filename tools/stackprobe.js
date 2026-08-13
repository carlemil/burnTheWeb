// Headless probe for the stack-item LIFECYCLE and the fullSnapshot↔applyBlob symmetry.
// Usage: node tools/stackprobe.js index.html
//
// Why this exists: the selected layer's store is the DOM, and the freeze/thaw/pointMaps/
// paintBlock machinery that moves a layer between "selected" (DOM + singletons) and
// "holds numbers" (frozen record) is the most order-sensitive code in the editor — every
// invariant below is stated in a comment at the site it protects, and violating any of
// them loses the user's last edit IN SILENCE (the render stays right; only later saves
// are wrong). Until this probe they were comment-enforced only. The persistence half is
// the same idea at the blob level: fullSnapshot writes what applyBlob reads, and a field
// added to one but not the other is data that saves-but-never-loads (or a read of a field
// nothing writes) with no error anywhere.
//
// All checks are STRUCTURAL — they slice the real built source by markers and assert
// shape/order, the same style as uiprobe. Keep the markers:
//   `function freezeItem(` … `function thawItem(` … `function paintBlock(` …
//   `function repaintAllBlocks(` … `function selectStack(` … `function addStackItem(`,
//   `function pointMaps(slot) {` … `CONTROLS.filter(c => c.type`,
//   `function stackItemOut(` … `function stackOut()` … `function mergeLayers(`,
//   `function installStack(items) {` … `function applyPreset(`,
//   `function fullSnapshot() {` … `function persist() {`,
//   `function applyBlob(` … `function restore(`.
const fs = require("fs");
const html = fs.readFileSync(process.argv[2] || "index.html", "utf8");
const s0 = html.indexOf("<script>"), s1 = html.indexOf("</script>", s0);
if (s0 < 0 || s1 < 0) throw new Error("probe: no inline <script> found");
const src = html.slice(s0 + 8, s1);

const cut = (from, to) => {
  const a = src.indexOf(from), b = src.indexOf(to, a + 1);
  if (a < 0 || b < 0 || b < a) throw new Error("probe: could not slice " + from + " .. " + to);
  return src.slice(a, b);
};
// Comments name the very identifiers being matched (they document these invariants), so
// they must go before any absence check — the presetprobe lesson.
const noComments = s => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

let pass = 0, fail = 0;
const ok = (cond, name, detail) => {
  (cond ? pass++ : fail++);
  console.log((cond ? "PASS  " : "FAIL  ") + name + (detail ? "  [" + detail + "]" : ""));
};
// Asserts a strictly increasing sequence of indexOf positions, all present.
const ordered = (body, ...needles) => {
  let last = -1;
  for (const n of needles) {
    const i = body.indexOf(n, last + 1);
    if (i < 0) return "missing: " + n;
    last = i;
  }
  return null;
};

// ---- 1. the freeze/thaw lifecycle -------------------------------------------------
{
  const thaw = noComments(cut("  function thawItem(", "  function paintBlock("));
  ok(/L\.state = L\.beat = L\.pulse = L\.plen = L\.btune = null/.test(thaw),
     "thawItem NULLS the record (exactly one of selected / holds-numbers is ever true)");

  const paint = noComments(cut("  function paintBlock(", "  function repaintAllBlocks("));
  ok(!/dispatchEvent/.test(paint),
     "paintBlock never dispatches input (a dispatch reaches onEdit and autosaves per block)");
  ok(/slot === stackSel/.test(paint),
     "paintBlock skips the selected block (it IS the store)");
  const bounds = ordered(paint, "applyLayerRangesTo(", "singlePair(");
  ok(!bounds, "paintBlock applies bounds BEFORE values (the DOM silently clamps otherwise)", bounds);
  ok(/singlePair\(/.test(paint),
     "paintBlock collapses single controls itself (the one write site that bypasses wireRange's mirror)");

  const select = noComments(cut("  function selectStack(", "  function addStackItem("));
  ok(/j === stackSel/.test(select), "selectStack early-returns on reselect");
  const order = ordered(select, "freezeItem(", "stackSel = j", "pointMaps(", "thawItem(",
                        "stageLayerExtras(", "setEffect(", "applyLayerExtras(", "paintBlock(");
  ok(!order, "selectStack runs freeze -> stackSel -> pointMaps -> thaw -> stage -> setEffect "
     + "-> applyExtras -> paint, in that order", order);

  const pm = noComments(cut("  function pointMaps(slot) {", "CONTROLS.filter(c => c.type"));
  ok(!/\.apply\b|\bapply\(/.test(pm),
     "pointMaps never calls apply (selection must not rewrite render globals out of turn)");
  ok(!/animPhase/.test(pm),
     "pointMaps never touches animPhase (recreating it teleports every drifting slider)");
}

// ---- 2. the persistence edge of the stack ----------------------------------------
{
  const itemOut = noComments(cut("  function stackItemOut(", "  function stackOut()"));
  for (const k of ["anim", "phase", "fxOff", "solids", "boids", "tetras"])
    ok(!new RegExp("\\b" + k + "\\s*:").test(itemOut),
       "stackItemOut never serialises `" + k + "` (transient / runtime-only)");

  const out = noComments(cut("  function stackOut()", "  function mergeLayers("));
  const seq = ordered(out, "freezeItem(", "stackItemOut", "thawItem(");
  ok(!seq, "stackOut is freeze -> map -> thaw (reading a frozen record without freezing "
     + "first loses the last edit)", seq);

  const inst = noComments(cut("  function installStack(items) {", "  function applyPreset("));
  ok(/repaintAllBlocks\(\)/.test(inst),
     "installStack repaints every block (a slot just changed which layer it holds)");
  const iseq = ordered(inst, "stackSel = 0", "pointMaps(0)", "thawItem(");
  ok(!iseq, "installStack re-points the maps before thawing item 0", iseq);
}

// ---- 3. fullSnapshot <-> applyBlob field symmetry ---------------------------------
// Every key fullSnapshot writes must be one applyBlob reads, and vice versa. A break in
// direction one is a setting that saves and silently never loads; in direction two it is
// a read of a field nothing writes (usually a rename that missed one side).
{
  const snap = noComments(cut("  function fullSnapshot() {", "  function persist() {"))
    .replace(/"[^"]*"/g, '""');
  // Top-level keys of the return literal, by depth scan — the values contain nested
  // objects/arrays/calls, so a flat regex cannot tell a key from an identifier inside one.
  const start = snap.indexOf("return {");
  ok(start >= 0, "fullSnapshot returns an object literal");
  const body = snap.slice(start + "return ".length);
  const snapKeys = [];
  let depth = 0, atEntry = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "{" || c === "[" || c === "(") { depth++; if (depth === 1) atEntry = true; continue; }
    if (c === "}" || c === "]" || c === ")") { depth--; if (depth === 0) break; continue; }
    if (depth === 1 && c === ",") { atEntry = true; continue; }
    if (depth === 1 && atEntry && /\w/.test(c)) {
      const m = body.slice(i).match(/^(\w+)/);
      snapKeys.push(m[1]);
      i += m[1].length - 1;
      atEntry = false;
    }
  }
  ok(snapKeys.length >= 20, "fullSnapshot emits a populated blob", snapKeys.join(","));

  const blob = noComments(cut("  function applyBlob(", "  function restore("));
  const readKeys = new Set([...blob.matchAll(/\bsaved\.(\w+)/g)].map(m => m[1]));

  const neverRead = snapKeys.filter(k => !readKeys.has(k));
  ok(!neverRead.length, "every field fullSnapshot writes is one applyBlob reads",
     neverRead.length ? "saved but never loaded: " + neverRead.join(", ") : snapKeys.length + " keys");
  const neverWritten = [...readKeys].filter(k => !snapKeys.includes(k));
  ok(!neverWritten.length, "every field applyBlob reads is one fullSnapshot writes",
     neverWritten.length ? "loaded but never saved: " + neverWritten.join(", ") : readKeys.size + " keys");
}

console.log("\n" + (fail ? fail + " FAILED, " : "") + "all " + pass + " passed");
process.exit(fail ? 1 : 0);
