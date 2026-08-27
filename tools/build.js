// Build the self-contained dev-index.html from src/ (no dependencies — plain Node fs).
//
// Usage:
//   node tools/build.js          rebuild dev-index.html from src/
//   node tools/build.js --check  exit 1 if dev-index.html differs from a fresh build
//
// dev-index.html is the deployed artifact. NOTHING rebuilds it automatically -- there are no
// git hooks in this repo (the /deploy skill says so outright) and the Pages workflow only
// uploads whatever is committed. `--check` is what CI runs to catch a stale one.
//
// It reads src/index.template.html (the HTML shell with {{CSS}} and {{JS}}
// markers), src/styles.css, and the JS slices listed in src/manifest.txt, then
// splices them in. The slices are concatenated VERBATIM (join with '') and the
// marker substitution uses split/join (not String.replace, whose replacement
// string treats `$` specially — and the JS is full of `$`). So the output is a
// byte-for-byte reproduction of the authored source.
"use strict";
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const srcDir = path.join(root, "src");
const read = f => fs.readFileSync(path.join(srcDir, f), "utf8");

const manifest = read("manifest.txt")
  .split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));

const jsBody = manifest.map(read).join("");
const css = read("styles.css");
const template = read("index.template.html");

if (template.split("{{CSS}}").length !== 2 || template.split("{{JS}}").length !== 2)
  throw new Error("template must contain exactly one {{CSS}} and one {{JS}} marker");

// ---- gates on the CONCATENATED WHOLE ------------------------------------------------------
// The app is ONE IIFE built from every slice in the manifest, so both failure modes below are
// properties of the JOINED result: nothing is wrong with any single file, and the page is blank
// with a single baffling error. Neither is visible to any probe -- they all read the built file
// as TEXT -- so this is the only place they can be caught. Both are cheap; run them every build.

// 1. DOES IT PARSE? CLAUDE.md's rule "NO BACKTICK ANYWHERE INSIDE AN FS_*/VS_* SOURCE, comments
//    included" exists because one stray backtick closes the template literal and the rest of the
//    GLSL is parsed as JavaScript -- the whole IIFE then dies with something like
//    "Unexpected identifier 'oct'" deep inside a shader. That rule was written with the note
//    "node tools/build.js will not catch it -- syntax-check the built file with new Function".
//    Now it does. A `\n` that became a real newline inside a literal lands here too.
try {
  new Function(jsBody);
} catch (e) {
  console.error("BUILD REJECTED: the concatenated JS does not parse.\n  " + e.message);
  console.error("  Most often a stray backtick inside an FS_*/VS_* shader source (comments count).");
  process.exit(1);
}

// 2. DOES ANY NAME COLLIDE? Every slice's top-level declarations share the single IIFE scope, so
//    a duplicate `const`/`let` is a SyntaxError (blank page) and a duplicate `function` silently
//    shadows -- which is worse, because it renders. There are ~1400 top-level names and nothing
//    else checks them. Top-level declarations in this codebase are exactly those at two-space
//    indent, so this needs no parser.
{
  const seen = new Map(), dup = [];
  const DECL = /^ {2}(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[=;])/;
  manifest.forEach(file => {
    read(file).split("\n").forEach((line, i) => {
      const m = DECL.exec(line);
      if (!m) return;
      const n = m[1] || m[2], at = file + ":" + (i + 1);
      // WITHIN one slice as well as across two. A second `function foo` in the same file parses
      // fine and silently replaces the first -- the quietest version of this bug, and the reason
      // this is a list rather than a per-file Set.
      if (seen.has(n)) dup.push(n + "  (" + seen.get(n) + " and " + at + ")");
      else seen.set(n, at);
    });
  });
  if (dup.length) {
    console.error("BUILD REJECTED: " + dup.length + " top-level name(s) declared in two slices.");
    dup.forEach(d => console.error("  " + d));
    console.error("  All " + manifest.length + " slices share one scope: a duplicate const/let is a\n" +
                  "  blank page, a duplicate function silently shadows. Rename one of each pair.");
    process.exit(1);
  }
}

const out = template.split("{{CSS}}").join(css).split("{{JS}}").join(jsBody);

const OUT = "dev-index.html";
const target = path.join(root, OUT);
const check = process.argv.includes("--check");

if (check) {
  const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
  if (current === out) { console.log(OUT + " is up to date with src/"); process.exit(0); }
  console.error(OUT + " is STALE — run `node tools/build.js` and commit the result.");
  process.exit(1);
}

fs.writeFileSync(target, out);
console.log(`built ${OUT} (${out.length}b) from ${manifest.length} JS slices + styles.css`);
