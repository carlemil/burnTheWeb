#!/usr/bin/env node
// RETIRED EFFECTS: an id that has been taken out of the registry must still resolve.
//
//   node tools/retireprobe.js [dev-index.html]
//
// WHY THIS EXISTS. `effectIndexFromId` returns -1 for an id it does not know, and every caller
// treats -1 as "drop it": mergeLayers loses the layer, validatePresetList loses the whole
// scene, the backup importer skips it. So deleting an effect descriptor does not just remove
// the effect -- it silently damages every saved scene, share link and backup that ever used
// it, which is the one thing this project says must never happen.
//
// Retiring an effect therefore means naming its heir in RETIRED_EFFECT_IDS, and this probe is
// what stops the next removal from forgetting. It slices the real tables and the real resolver
// out of the built file rather than re-implementing them, so it cannot drift from the app.
//
// It also pins the two things that must NOT change while doing so: LEGACY_EFFECT_IDS is
// POSITIONAL (old numeric blobs index into it), so nothing may be inserted or removed there;
// and a genuinely unknown id must still be rejected, or a typo would silently become an effect.
const fs = require("fs");
const src = fs.readFileSync(process.argv[2] || "dev-index.html", "utf8");

let fails = 0;
function ok(name, cond, extra) {
  if (typeof name !== "string") { console.log("FAIL  ok() called with its arguments swapped"); fails++; return; }
  console.log((cond ? "PASS  " : "FAIL  ") + name + (extra ? "  [" + extra + "]" : ""));
  if (!cond) fails++;
}

const ids = [...src.matchAll(/\{\s*id:\s*"([a-z0-9]+)",\s*name:\s*"[^"]+",\s*subtitle:/g)].map(m => m[1]);
ok("sliced the effect registry", ids.length > 30, ids.length + " effects");

const legacy = src.match(/const LEGACY_EFFECT_IDS = (\[[^\]]*\]);/);
const retired = src.match(/const RETIRED_EFFECT_IDS = (\{[^}]*\});/);
const fn = src.match(/function effectIndexFromId\(v\) \{[\s\S]*?\n  \}/);
ok("sliced LEGACY_EFFECT_IDS", !!legacy);
ok("sliced RETIRED_EFFECT_IDS", !!retired);
ok("sliced effectIndexFromId", !!fn);
if (!legacy || !retired || !fn || !ids.length) { console.log("DONE fails=" + fails); process.exit(1); }

const EFFECTS = ids.map(id => ({ id }));
const LEGACY_EFFECT_IDS = eval(legacy[1]);
const RETIRED_EFFECT_IDS = eval("(" + retired[1] + ")");
eval(fn[0]);

// EVERY retired id must land on a LIVE effect. This is the whole contract.
for (const dead in RETIRED_EFFECT_IDS) {
  const heir = RETIRED_EFFECT_IDS[dead];
  ok("retired '" + dead + "' is really gone from the registry", ids.indexOf(dead) < 0);
  ok("...its heir '" + heir + "' is a live effect", ids.indexOf(heir) >= 0);
  const i = effectIndexFromId(dead);
  ok("...and it resolves rather than coming back -1", i >= 0, "index " + i);
  ok("...specifically to " + heir, ids[i] === heir, ids[i]);
}

// The legacy positional table is a WIRE FORMAT: old numeric blobs index straight into it, so
// its contents and ORDER are frozen. A retired effect must never have been in it.
ok("LEGACY_EFFECT_IDS is unchanged (positional, frozen)",
   JSON.stringify(LEGACY_EFFECT_IDS) === JSON.stringify(["sirpinfyer", "tetrafyer", "animejulia", "plasma"]),
   JSON.stringify(LEGACY_EFFECT_IDS));
for (let n = 0; n < LEGACY_EFFECT_IDS.length; n++)
  ok("legacy numeric " + n + " still resolves to " + LEGACY_EFFECT_IDS[n],
     ids[effectIndexFromId(n)] === LEGACY_EFFECT_IDS[n]);
for (const dead in RETIRED_EFFECT_IDS)
  ok("retired '" + dead + "' was never a legacy positional id", LEGACY_EFFECT_IDS.indexOf(dead) < 0);

// ...and the resolver must still say no to something that is genuinely not an effect, or a
// typo in a blob would quietly become whatever the map happened to contain.
ok("a live id still resolves to itself", ids[effectIndexFromId("plasma")] === "plasma");
ok("a genuinely unknown id is still rejected", effectIndexFromId("nosucheffect") === -1);

console.log(fails ? "\n" + fails + " FAILED" : "\nall " + ids.length + " effects, retirement contract holds");
process.exit(fails ? 1 : 0);
