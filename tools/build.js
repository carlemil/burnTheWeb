// Build the self-contained index.html from src/ (no dependencies — plain Node fs).
//
// Usage:
//   node tools/build.js          rebuild index.html from src/
//   node tools/build.js --check  exit 1 if index.html differs from a fresh build
//                                (drift guard — used by .githooks/pre-commit)
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

const out = template.split("{{CSS}}").join(css).split("{{JS}}").join(jsBody);

const target = path.join(root, "index.html");
const check = process.argv.includes("--check");

if (check) {
  const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
  if (current === out) { console.log("index.html is up to date with src/"); process.exit(0); }
  console.error("index.html is STALE — run `node tools/build.js` and commit the result.");
  process.exit(1);
}

fs.writeFileSync(target, out);
console.log(`built index.html (${out.length}b) from ${manifest.length} JS slices + styles.css`);
