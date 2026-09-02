// The "AI-Generated" scene collection: ten beat-synced scenes built from shipped effects and
// filters, authored SPARSELY in the wire format (string effect + palette ids, [lo,hi] pairs)
// and handed out as a #zp= bundle link. Everything not named here is the effect's default
// (mergeState/mergeBeat/mergePulse/mergePlen overlay only the supplied keys), so the file
// stays readable and a registry default that moves later moves these scenes with it.
//
//   node tools/ai-scenes.js                       print the https://kicktro.com/#zp= link
//   node tools/ai-scenes.js --json                print the bundle blob
//   node tools/ai-scenes.js --check <outdir>      vocabulary check + one probe page per scene,
//                                                 then the msedge lines to run
//   node tools/ai-scenes.js --check <outdir> --run  ...and run them (real GPU headless Edge),
//                                                 printing AISCENE|i|name|scenenow|errors|glErr
//                                                 (--only 3,7 renders just those)
//
// Install: open the link in a browser signed in as the target account, choose Replace,
// Restore, Save to cloud, tick Publish to gallery.
//
// Authoring shorthand, expanded by build(): a state value is  v  (pinned, stored [v, v]),
// [lo, hi]  (drifts between the thumbs), or  [lo, hi, "band/shape/len"]  (armed on that
// band — low/mid/high — with that pulse shape and length in seconds). Only reactive shapes
// (snap pluck sustain ease bounce steps swell bloom): the anticipatory ones need tempo lock,
// which ships off. Never arm a `single` control (counts, enums) — they have no chips.
// Layer 0 is the bottom; the shared filter keys (bloom, vignette, grain, scan, scancount,
// barrel, burn) are read from layer 0's state on load, so they live there.
"use strict";
const fs = require("fs"), path = require("path"), zlib = require("zlib"), { spawnSync } = require("child_process");

const L = (effect, palette, state, filters, blend, gain) => ({ effect, palette, state, filters, blend, gain });

const DESIGN = [
  ["Neon Reef", [
    L("voronoi", "electric", { vocells: [5, 9], voedge: [0.3, 0.9, "mid/pluck/0.25"], vojit: 0.8, vospeed: 0.4,
      zfb: 1.015, zfbkeep: 0.85, bloom: 0.35 }, ["zoomfb", "bloom"], "max", 1),
    L("metaballs", "ice", { mbcount: 6, mbradius: [0.10, 0.22, "low/swell/0.35"], mbspeed: 0.7, mbgain: 1.1,
      chroma: [0.5, 4, "high/snap/0.2"] }, ["chroma", "bloom"], "add", 0.6),
  ]],
  ["Storm Front", [
    L("clouds", "sunset", { clcover: 0.6, clscale: 1.2, cllight: [0.8, 2.4, "low/ease/0.5"], clspeed: 1.2,
      vignette: 0.45, grain: 0.06, bloom: 0.4 }, ["vignette", "grain"], "max", 1),
    L("lightning", "electric", { ltstrike: [0, 1, "low/snap/0.3"], ltrate: 0.3, ltbolts: 3, ltglow: [0.3, 0.9, "high/pluck/0.2"],
      diffuse: 2.5, diffkeep: 0.9 }, ["diffuse", "bloom"], "add", 0.9),
  ]],
  ["Slime Cathedral", [
    L("physarum", "greenhaze", { phcount: 3500, phsense: [6, 20, "mid/snap/0.3"], phspeed: [0.8, 2.4, "low/sustain/0.4"],
      phdecay: 0.92, phscatter: 0.35, fade: 0.97, edge: 0.5, bloom: 0.45 }, ["fade", "edge", "bloom"], "max", 1),
    L("gyroid", "copper", { gyfreq: 1.8, gythick: [0.25, 0.6, "low/ease/0.35"], gyglow: [0.3, 1.2, "high/pluck/0.2"],
      gywarp: 0.5, gyspeed: 0.6 }, [], "ddg", 0.6),
  ]],
  ["Ember Attractor", [
    // Two de Jong attractors: the coefficients ARE the shape, so a beat on a coefficient morphs
    // the whole figure. The lower one is mirrored fourfold and swirls its trail; the upper one
    // has jitter that puffs it on the highs.
    L("attractor", "ember", { ata: [1.2, 1.7, "low/ease/0.5"], atb: -2.3, atc: [2.2, 2.6, "mid/sustain/0.4"], atd: -2.1,
      atjit: 0.3, points: 20000, swirl: [2, 9, "low/snap/0.3"], swirlkeep: 0.95, mirror: 3, bloom: 0.5 },
      ["swirl", "mirror", "bloom"], "max", 1),
    L("attractor", "fire", { ata: -1.9, atb: [1.6, 2.1, "low/pluck/0.35"], atc: -0.7, atd: -2.4,
      atjit: [0.2, 1.4, "high/pluck/0.2"], points: 14000, fade: 0.96 }, ["fade"], "add", 0.8),
  ]],
  ["Deep Sea Glass", [
    L("ocean", "ice", { gosurf: 2, goheight: [0.8, 1.5, "low/ease/0.6"], goreflect: 0.8, gofoam: [0.3, 0.8, "high/pluck/0.2"],
      gochop: 2.5, bloom: 1.2, vignette: 0.35 }, ["bloom", "vignette"], "max", 1),
    L("glass", "chrome", { gbcount: 2, gbsize: 0.5, gbmat: 0, gbior: [1.3, 1.9, "low/sustain/0.4"], gbglow: [0.5, 1.4, "mid/snap/0.2"],
      chroma: 1.2 }, ["chroma"], "add", 1),
  ]],
  ["Mandelbox Drive", [
    L("mbox", "purple", { bxscale: [-1.75, -1.55, "low/ease/0.5"], bxglow: [0.4, 1.4, "high/pluck/0.2"], bxspeed: 0.8,
      rblamt: [0.3, 1.8, "low/snap/0.3"], rblmix: 0.6, bloom: 0.4 }, ["rblur", "bloom"], "max", 1),
    L("starfield", "chrome", { stspeed: [0.6, 3, "low/swell/0.3"], stwarp: [0, 0.7, "mid/ease/0.35"], stdensity: 1.4,
      diffuse: 2, diffkeep: 0.93 }, ["diffuse"], "add", 0.7),
  ]],
  ["Truchet Circuit", [
    L("truchet", "c64", { trucells: [6, 10, "mid/steps/0.4"], truwidth: [0.2, 0.5, "low/pluck/0.25"], truspeed: 1.5,
      pixel: 6, crtmask: 0.5, crtbleed: 0.4, bloom: 0.3, scan: 0.4, scancount: 240 }, ["pixelate", "crt"], "max", 1),
    L("munch", "cga", { xorspeed: [10, 50, "low/snap/0.2"], xorscale: 0.5, poster: 4 }, ["poster"], "xor", 0.4),
    L("copperbars", "rainbow", { cbcount: 4, cbspeed: [0.5, 2, "high/pluck/0.2"], cbwidth: 0.06 }, ["scanlines"], "add", 0.3),
  ]],
  ["Galaxy Bloom", [
    L("aurora", "verdant", { aucurtains: 3, ausway: 0.4, aushimmer: [0.6, 2.5, "high/snap/0.2"],
      soften: -0.3, softrad: 2.5, bloom: 0.45 }, ["soften"], "max", 1),
    L("galaxy", "purple", { gxarms: 3, gxspin: [0.3, 1.2, "low/ease/0.5"], gxcore: [0.2, 0.9, "high/pluck/0.2"], gxscatter: 0.35,
      points: 20000, zoom: 2, fade: 0.965 }, ["fade", "bloom"], "add", 0.9),
    L("harmonograph", "electric", { hgratio: 2.5, hgdetune: [0.005, 0.04, "mid/bounce/0.4"], hgmorph: [0.2, 1.4, "low/sustain/0.35"],
      points: 20000, fade: 0.98, chroma: 1.5 }, ["fade", "chroma"], "add", 0.5),
  ]],
  ["Event Horizon", [
    L("bhole", "amber", { bhtilt: 18, bhspin: [0.8, 2.5, "low/ease/0.45"], bhbeam: [0.6, 1.4, "mid/pluck/0.25"], bhorbit: 0.1,
      shock: [0, 1, "low/snap/0.6"], shockamp: 0.08, shockwidth: 0.14, bloom: 0.5, vignette: 0.4 }, ["shock", "bloom", "vignette"], "max", 1),
    L("cymatics", "ice", { cymode: [3, 7, "low/steps/0.5"], cysharp: 6, cyshimmer: [0.3, 1.5, "high/pluck/0.2"],
      edge: 0.6, dithlvl: 5 }, ["edge", "dither"], "diff", 0.55),
  ]],
  ["Menger Bass", [
    L("menger", "toxic", { mgdive: [0.4, 1.6, "low/sustain/0.5"], mgglow: [0.3, 1.1, "high/pluck/0.2"], mgrot: 0.3,
      chroma: [0.3, 3.5, "low/snap/0.2"], bloom: 0.4, grain: 0.05 }, ["chroma", "bloom", "grain"], "max", 1),
    L("ribbons", "tricolor", { rbcount: 5, rbwidth: [0.25, 0.7, "low/ease/0.3"], rbtwist: [1.5, 6, "mid/bounce/0.5"], rbspeed: 1.2,
      echo: 3, echoang: 90, echokeep: 0.9 }, ["echo"], "add", 0.75),
  ]],
];

// Expand the shorthand into a wire-format layer item.
function layerOut(l) {
  const state = {}, beat = {}, pulse = {}, plen = {};
  for (const k in l.state) {
    const v = l.state[k];
    if (!Array.isArray(v)) { state[k] = [v, v]; continue; }
    state[k] = [v[0], v[1]];
    if (v[2]) {
      const [band, shape, len] = v[2].split("/");
      beat[k] = { low: band === "low", mid: band === "mid", high: band === "high" };
      pulse[k] = shape; plen[k] = +len;
    }
  }
  return { effect: l.effect, state, beat, pulse, plen, palette: l.palette, filters: l.filters, blend: l.blend, gain: l.gain };
}
function build() {
  return DESIGN.map(([name, layers]) => {
    const out = layers.map(layerOut), l0 = out[0];
    // validatePresetList needs truthy state/beat/extra and a known top-level effect; the
    // rest of the picture rides in `layers`.
    return { name, effect: l0.effect, state: l0.state, beat: l0.beat, pulse: l0.pulse, plen: l0.plen,
             extra: { palette: l0.palette, filters: l0.filters }, layers: out };
  });
}
const SCENES = build();
const blob = { presets: SCENES, cycle: true, curPreset: 0 };
const link = "https://kicktro.com/#zp=" + zlib.deflateRawSync(Buffer.from(JSON.stringify(blob))).toString("base64url");

// ---- vocabulary check against the built page: every id and key must exist ----
function checkVocab(html) {
  const ids = re => new Set([...html.matchAll(re)].map(m => m[1]));
  const all = ids(/\{ id: "([a-z0-9]+)"/g);                         // effects + filters (+ others, harmless)
  const keys = ids(/\{ key: "([a-z0-9]+)", host: "(?:fx|filter|pal)"/g);
  const pals = new Set((html.match(/const PAL_IDS = \[([^\]]*)\]/) || ["", ""])[1].match(/"([a-z0-9]+)"/g).map(s => s.slice(1, -1)));
  const single = ids(/\{ key: "([a-z0-9]+)", host: "(?:fx|filter)"[^\n]*single: true/g);
  const shapes = new Set(["snap", "pluck", "sustain", "ease", "bounce", "steps", "swell", "bloom"]);
  const blends = new Set((html.match(/const BLEND_MODES = \[[\s\S]*?\n  \];/) || [""])[0].match(/id: "([a-z]+)"/g).map(s => s.slice(5, -1)));
  const bad = [];
  for (const [name, layers] of DESIGN) for (const l of layers) {
    if (!all.has(l.effect)) bad.push(name + ": effect " + l.effect);
    if (!pals.has(l.palette)) bad.push(name + ": palette " + l.palette);
    if (!blends.has(l.blend)) bad.push(name + ": blend " + l.blend);
    for (const f of l.filters) if (!all.has(f)) bad.push(name + ": filter " + f);
    for (const k in l.state) {
      if (!keys.has(k)) bad.push(name + ": key " + k);
      const v = l.state[k];
      if (Array.isArray(v) && v[2]) {
        if (single.has(k)) bad.push(name + ": armed single control " + k);
        if (!shapes.has(v[2].split("/")[1])) bad.push(name + ": shape " + v[2]);
      }
    }
  }
  return bad;
}

// ---- probe pages: seed the library into localStorage, land on scene i, report ----
function probePage(html, i) {
  const NL = String.fromCharCode(10);
  const seed = JSON.stringify({ presets: SCENES, curPreset: i, cycle: false, tdur: [0, 0], panelOpen: false, audio: "off" });
  const head = [
    "<script>",
    "localStorage.setItem('burnTheWeb.tutorial.v1','true');",
    "localStorage.setItem('burnTheWeb.sync.v1',JSON.stringify({shows:3,sinceLast:0,used:true}));",
    "localStorage.setItem('burnTheWeb.credits.v1','off');",
    "localStorage.setItem('burnTheWeb.v1'," + JSON.stringify(seed) + ");",
    // curPreset only SELECTS; the one-shot the Restore dialog writes is what makes startup APPLY it.
    "sessionStorage.setItem('btw.applyPreset','" + i + "');",
    "var errs=0, glc=null; window.addEventListener('error',function(){errs++});",
    "var ce=console.error; console.error=function(){errs++; ce.apply(console,arguments)};",
    "var gc=HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext=function(t){var c=gc.apply(this,arguments); if(t==='webgl2'&&c) glc=c; return c;};",
    "setTimeout(function(){ requestAnimationFrame(function(){",
    "  var now=(document.getElementById('scenenow')||{}).textContent||'';",
    "  console.log('AISCENE|" + i + "|" + SCENES[i].name + "|'+now+'|'+errs+'|'+(glc?glc.getError():'nogl'));",
    "}); }, 3000);",
    "</script>",
  ].join(NL);
  return html.replace("<head>", "<head>" + head);
}

const argv = process.argv.slice(2);
if (argv[0] === "--json") {
  console.log(JSON.stringify(blob));
} else if (argv[0] === "--check") {
  const out = argv[1], page = argv[2] && !argv[2].startsWith("--") ? argv[2] : path.join(__dirname, "..", "dev-index.html");
  const html = fs.readFileSync(page, "utf8");
  const bad = checkVocab(html);
  if (bad.length) { console.error("VOCAB FAIL:" + String.fromCharCode(10) + bad.join(String.fromCharCode(10))); process.exit(1); }
  console.log("vocab ok: " + SCENES.length + " scenes, " + DESIGN.reduce((n, d) => n + d[1].length, 0) + " layers");
  const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
  const lines = SCENES.map((s, i) => {
    const p = path.join(out, "ai-" + i + ".html");
    fs.writeFileSync(p, probePage(html, i));
    const url = "file:///" + p.split(String.fromCharCode(92)).join("/") + "?hideui&credits=0";
    const args = ["--headless=new", "--disable-extensions", "--enable-logging=stderr", "--v=0", "--window-size=1280,800",
      "--virtual-time-budget=6000", "--screenshot=" + path.join(out, "ai-" + i + ".png"), url];
    return { args, line: "msedge " + args.map(a => a.includes(" ") ? JSON.stringify(a) : a).join(" ") };
  });
  const only = argv.indexOf("--only") >= 0 ? argv[argv.indexOf("--only") + 1].split(",").map(Number) : null;
  if (!argv.includes("--run")) { lines.forEach(l => console.log(l.line)); }
  else for (const [i, l] of lines.entries()) {
    if (only && !only.includes(i)) continue;
    const r = spawnSync(edge, l.args, { encoding: "utf8", timeout: 120000, maxBuffer: 64 << 20 });
    const m = String(r.stderr || "").match(/AISCENE\|[^\n"]*/);
    console.log(m ? m[0] : "NO RESULT for " + l.args[l.args.length - 1]);
  }
} else {
  console.log(link);
  console.log(link.length + " chars, " + SCENES.length + " scenes");
}
