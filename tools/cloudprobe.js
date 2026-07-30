#!/usr/bin/env node
// Cloud profiles — pure-logic probe.
//
//   node tools/cloudprobe.js dev-index.html
//
// Slices the REAL Firestore typed-value codec out of the built file and drives it in Node.
// It exists because the wire format has one genuinely surprising rule — **integers are
// STRINGS** (`{"integerValue":"7"}`) — and getting it wrong fails at the server with a schema
// error rather than anywhere a screenshot or a headless click-through would show it.
//
// It also pins the boundary this feature leans on hardest: a profile's payload is byte-for-
// byte the same blob a `#zp=` preset-bundle link carries. If those two ever diverge, a cloud
// profile stops being loadable through openSharedLibrary and the feature quietly needs its
// own decoder. That is asserted structurally, against the source, rather than by round-
// tripping (the codec is async browser CompressionStream, which Node's slice cannot run).
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

const codec = slice("function fsOut(o) {", "// ---- tokens ----");
const M = new Function(codec + "\n return { fsOut, fsIn };")();

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  console.log((cond ? "PASS " : "FAIL ") + " " + name + (extra !== undefined ? "  [" + extra + "]" : ""));
  cond ? pass++ : fail++;
}

console.log("--- Cloud profiles: Firestore codec (" + file + ")\n");

// ---- fsOut: the typed-value encoder ----------------------------------------------
{
  const out = M.fsOut({ name: "Erbsman", payload: "abc", count: 7, pub: true });
  ok("wraps everything in a `fields` envelope", !!out.fields && typeof out.fields === "object");
  ok("string → stringValue", out.fields.name.stringValue === "Erbsman", JSON.stringify(out.fields.name));
  ok("bool → booleanValue", out.fields.pub.booleanValue === true, JSON.stringify(out.fields.pub));
  // The one that bites: Firestore rejects a JSON number here.
  ok("integer → integerValue as a STRING", out.fields.count.integerValue === "7",
     JSON.stringify(out.fields.count));
  ok("...and not as a number", typeof out.fields.count.integerValue === "string",
     typeof out.fields.count.integerValue);
  const dt = M.fsOut({ updated: new Date(Date.UTC(2026, 6, 30, 12, 0, 0)) });
  ok("Date → RFC3339 timestampValue", dt.fields.updated.timestampValue === "2026-07-30T12:00:00.000Z",
     dt.fields.updated.timestampValue);
  ok("a non-integer number stays a double", M.fsOut({ x: 1.5 }).fields.x.doubleValue === 1.5);
  // Anything the encoder does not understand must be DROPPED, not emitted half-formed — the
  // rules' hasOnly() check rejects the whole write if an unexpected key reaches the document.
  ok("unsupported types are dropped, not emitted",
     Object.keys(M.fsOut({ good: "a", bad: { nested: 1 }, alsoBad: undefined, worse: null }).fields).join(",") === "good");
}

// ---- fsIn: the decoder ------------------------------------------------------------
{
  const doc = { fields: {
    name: { stringValue: "Erbsman" },
    payload: { stringValue: "zzz" },
    count: { integerValue: "12" },
    pub: { booleanValue: false },
    updated: { timestampValue: "2026-07-30T12:00:00Z" },
  } };
  const d = M.fsIn(doc);
  ok("decodes strings", d.name === "Erbsman");
  ok("decodes integers back to numbers", d.count === 12 && typeof d.count === "number", typeof d.count);
  ok("decodes false correctly (not dropped)", d.pub === false, JSON.stringify(d.pub));
  ok("keeps the timestamp as its string", d.updated === "2026-07-30T12:00:00Z");
  ok("a missing document decodes to an empty object", Object.keys(M.fsIn(null)).length === 0);
  ok("a document with no fields decodes to an empty object", Object.keys(M.fsIn({})).length === 0);
  ok("nullValue survives as null", M.fsIn({ fields: { x: { nullValue: null } } }).x === null);
}

// ---- round trip -------------------------------------------------------------------
{
  const orig = { name: "My ramps", payload: "AbC-_123", count: 0, pub: true };
  const back = M.fsIn(M.fsOut(orig));
  ok("out → in round-trips every field", JSON.stringify(back) === JSON.stringify(orig),
     JSON.stringify(back));
  // count 0 and pub false are the falsy pair a naive `if (v)` encoder silently drops.
  const falsy = M.fsIn(M.fsOut({ count: 0, pub: false, name: "" }));
  ok("falsy values survive the round trip", falsy.count === 0 && falsy.pub === false && falsy.name === "",
     JSON.stringify(falsy));
}

// ---- structural: the payload IS a preset-bundle blob -------------------------------
{
  const blobFn = slice("function cloudBlob() {", "// ---- save / load / delete ----");
  ok("cloudBlob runs the same serializeBlob() the share link does", /serializeBlob\(/.test(blobFn));
  ok("...and carries presets + cycle + curPreset, like libraryUrl",
     /presets:/.test(blobFn) && /cycle:/.test(blobFn) && /curPreset/.test(blobFn));
  const save = slice("function cloudSave() {", "function cloudLoad()");
  ok("save compresses with the share codec (zipToB64)", /zipToB64\(/.test(save));
  ok("...and enforces the same size cap the rules do", /maxPayload/.test(save));
  const load = slice("function cloudLoad() {", "function cloudDelete()");
  ok("load expands with the share codec (unzipFromB64)", /unzipFromB64\(/.test(load));
  // The whole reason the feature is small: a downloaded profile goes through the EXISTING
  // shared-library path, so it inherits validation and the merge/replace dialog.
  ok("load hands the blob to openSharedLibrary, not a private decoder",
     /openSharedLibrary\(/.test(load));
}

// ---- structural: the kill switch ---------------------------------------------------
{
  const init = slice("function cloudInit() {", "if (el(\"cloud-save\")");
  ok("cloudInit early-returns when unconfigured", /if\s*\(!cloudOn\(\)\)\s*return/.test(init));
  ok("...before loading any third-party script",
     init.indexOf("!cloudOn()") < init.indexOf("GIS_SRC"), "gate precedes the script append");
  const on = slice("const cloudOn =", "const CLOUD_KEY");
  ok("cloudOn requires BOTH an api key and a project id",
     /apiKey/.test(on) && /projectId/.test(on), on.trim());
}

// ---- structural: token handling ----------------------------------------------------
{
  const fetchFn = slice("function cloudFetch(url, opts, retried)", "// ---- sign in / out ----");
  ok("a 401 retries exactly once", /!retried/.test(fetchFn) && /cloudFetch\(url, opts, true\)/.test(fetchFn));
  const fresh = slice("function cloudFresh() {", "// One authorised Firestore call");
  ok("the token is refreshed BEFORE it expires, not after", /-\s*60000/.test(fresh));
  ok("a dead refresh token signs out instead of looping", /cloudSignOut\(\)/.test(fresh));
  ok("session lives under its own storage key, not the scene blob",
     /CLOUD_KEY\s*=\s*"burnTheWeb\.cloud/.test(src));
}

console.log("\n" + (fail ? fail + " FAILED, " + pass + " passed" : "all " + pass + " passed"));
process.exit(fail ? 1 : 0);
