// Share-parity test (needs headless Edge; not a pure-Node probe).
//
//   node tools/shareparity.js [dev-index.html]
//
// Proves a "Share presets…" bundle reproduces the SOURCE scene exactly on the RECEIVER:
// builds a rich multi-layer scene in browser A, shares it as a #zp= link, opens that link
// in a fresh browser B, restores + selects the preset, and DEEP-COMPARES every layer and
// scene-global value read from the two. A mismatch means a field is dropped or changed in
// flight. Also spot-checks that A itself applied the intended values (so a shared bug can't
// pass by both sides being wrong together).
//
// Runs the app with requestAnimationFrame no-op'd and no GL: the picker / restore / apply
// paths need no frames, which keeps each launch fast. Reads state via --dump-dom.
const fs = require("fs"), zlib = require("zlib"), cp = require("child_process"), path = require("path");
const EDGE = process.env.EDGE || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const SRC = path.resolve(process.argv[2] || "dev-index.html");
const OUT = path.join(require("os").tmpdir(), "btw-shareparity");
fs.mkdirSync(OUT, { recursive: true });
const html = fs.readFileSync(SRC, "utf8");

// ---- the rich scene: distinctive, non-default values across every reported category ----
// Sparse layer states are fine — mergeState fills the rest from each effect's defaults.
const L = (effect, extra) => Object.assign({ effect, state: {}, beat: {}, pulse: {}, plen: {} }, extra);
const rich = {
  name: "RICH", effect: "multibrot", state: {}, beat: {}, pulse: {}, plen: {},
  extra: { palette: "5", filters: ["fade", "bloom"] },
  sceneFx: { on: ["bloom", "vignette", "scanlines", "grain", "barrel"],
    vals: { bloom: [0.5, 1.5], vignette: [0.6, 0.6], scan: [0.55, 0.55], scancount: [180, 180], barrel: [0.2, 0.2], grain: [0.09, 0.09] } },
  ttl: [45, 90], tdur: [1.5, 2.5],
  ranges: { "palcycle-lo": { min: "0", max: "20", step: "any" }, "palcycle-hi": { min: "0", max: "20", step: "any" } },
  layers: [
    L("multibrot", { state: { rpm: [3, 3], ratio: [8, 8], fade: [0.9, 0.9], camrx: [10, 10] },
      pulse: { rpm: "bounce" }, plen: { rpm: 0.44 },
      palette: "5", paletteRev: true, paletteBg: "white", filters: ["fade", "bloom"],
      blend: "add", gain: 0.9, mute: false,
      ranges: { "rpm-lo": { min: "0.5", max: "7", step: "any" }, "rpm-hi": { min: "0.5", max: "7", step: "any" } } }),
    L("multibrot", { state: { camrx: [-5, -5] }, palette: "7", filters: ["bloom"], blend: "diff", gain: 0.6, mute: true }),
    L("tetrafyer", { palette: "9", filters: ["bloom"], blend: "mul", gain: 0.5, mute: false, showBox: true }),
    L("copperbars", { palette: "11", filters: ["bloom"], blend: "rgb", gain: 0.4, mute: false }),
  ],
};
const seedBlob = JSON.stringify({ presets: [rich], curPreset: -1 });

// Read the whole applied scene: select each layer in turn (its per-layer values go live), then
// the scene-globals once. Returns a plain object safe to JSON-compare.
const READALL = `
async function readAll(){
  var q=function(id){return document.getElementById(id);};
  var v=function(id){var e=q(id);return e?e.value:null;};
  var chk=function(id){var e=q(id);return e?e.checked:null;};
  var mn=function(id){var e=q(id);return e?e.min:null;};
  var mx=function(id){var e=q(id);return e?e.max:null;};
  function wait(ms){return new Promise(function(r){setTimeout(r,ms);});}
  var rows=document.querySelectorAll('#stacklist .lyr');
  var layers=[];
  for(var k=0;k<rows.length;k++){
    document.querySelectorAll('#stacklist .lyr')[k].click();
    await wait(160);
    var r=document.querySelectorAll('#stacklist .lyr')[k];
    var bs=r.querySelector('.lyr-blend select');
    var gs=r.querySelector('.lyr-ctl input[type=range]');
    var mb=r.querySelector('.lyr-ctl b');
    var ps=document.querySelector('#ctl-rpm .pulsesel');
    layers.push({
      effect:v('effect'), blend:bs?bs.value:null, gain:gs?gs.value:null, mute:mb?mb.textContent:null,
      palette:v('palette'), palrev:chk('palrev'), palbg:v('palbg'), showBox:chk('showbox'),
      rpmMin:mn('rpm-lo'), rpmMax:mx('rpm-lo'), rpmLo:v('rpm-lo'), rpmHi:v('rpm-hi'),
      ratio:[v('ratio-lo'),v('ratio-hi')], fade:[v('fade-lo'),v('fade-hi')], camrx:[v('camrx-lo'),v('camrx-hi')],
      plenRpm:v('plen-rpm'), pulseRpm:ps?ps.value:null,
    });
  }
  return { layers:layers, scene:{
    ttl:[v('ttl-lo'),v('ttl-hi')], tdur:[v('tdur-lo'),v('tdur-hi')],
    flt:{bloom:chk('flt-bloom'),vignette:chk('flt-vignette'),scanlines:chk('flt-scanlines'),grain:chk('flt-grain'),barrel:chk('flt-barrel')},
    vignette:[v('vignette-lo'),v('vignette-hi')], scan:[v('scan-lo'),v('scan-hi')], grain:[v('grain-lo'),v('grain-hi')], barrel:[v('barrel-lo'),v('barrel-hi')],
    palcycleMax:mx('palcycle-lo'),
  }};
}`;

function page(headExtra, driverBody) {
  const head = `<script>window.requestAnimationFrame=function(){return 0;};${headExtra}</script>`;
  const driver = `<script>${READALL}\n(function(){${driverBody}})();</script>`;
  return html.replace("<head>", "<head>" + head).replace("</body>", driver + "</body>");
}
function launch(file, url) {
  const res = cp.spawnSync(EDGE, ["--headless=new", "--disable-gpu", "--no-sandbox", "--dump-dom",
    "--virtual-time-budget=12000", "--user-data-dir=" + path.join(OUT, "prof-" + file), url],
    { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
  const m = (res.stdout || "").match(/data-test="([^"]*)"/);
  if (!m) throw new Error("no data-test (" + file + "). stderr:\n" + (res.stderr || "").slice(-700));
  return JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
}

// ---- Phase A: seed the rich scene, apply it, read it, share it ----
const headA = `window.ClipboardItem=undefined;`
  + `Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:function(t){window.__cap=t;return Promise.resolve();},write:function(){return Promise.resolve();}}});`
  + `try{localStorage.setItem('burnTheWeb.v1',${JSON.stringify(seedBlob)});}catch(e){}`;
const driverA = `
  var q=function(id){return document.getElementById(id);};
  function wait(ms){return new Promise(function(r){setTimeout(r,ms);});}
  async function until(c,t){for(var i=0;i<(t||150);i++){if(c())return true;await wait(100);}return false;}
  (async function(){
    var out={ok:false};
    try{
      await until(function(){return q('preset')&&q('preset').options.length>1;});
      q('preset').value='0'; q('preset').dispatchEvent(new Event('change',{bubbles:true}));
      await wait(300);
      out.state=await readAll();
      window.__cap='';
      q('sharepresets').click();
      await until(function(){return document.querySelectorAll('#sharepre-list .sharepre-opt').length>0;},60);
      q('sharepre-copy').click();
      await until(function(){return window.__cap&&window.__cap.indexOf('#zp=')>=0;},100);
      out.link=window.__cap; out.ok=true;
    }catch(e){out.err=String(e&&e.message||e);}
    document.body.setAttribute('data-test',JSON.stringify(out));
  })();`;
fs.writeFileSync(path.join(OUT, "a.html"), page(headA, driverA));
const A = launch("a", "file:///" + path.join(OUT, "a.html").replace(/\\/g, "/"));
if (!A.ok) throw new Error("phase A failed: " + (A.err || JSON.stringify(A)));

// ---- Phase B: open the shared link, restore(replace), reload, apply, read ----
const zpB = A.link.match(/[#?&]zp=([^#?&]+)/)[1];
const driverB = `
  var q=function(id){return document.getElementById(id);};
  function wait(ms){return new Promise(function(r){setTimeout(r,ms);});}
  async function until(c,t){for(var i=0;i<(t||150);i++){if(c())return true;await wait(100);}return false;}
  (async function(){
    try{
      if(sessionStorage.getItem('phase')!=='2'){
        var ok=await until(function(){return q('restoredlg')&&!q('restoredlg').classList.contains('hidden');});
        if(!ok){document.body.setAttribute('data-test',JSON.stringify({err:'no restore dialog'}));return;}
        q('rst-replace').checked=true; q('rst-replace').dispatchEvent(new Event('change',{bubbles:true}));
        sessionStorage.setItem('phase','2');
        q('rst-go').click();
      }else{
        await until(function(){return q('preset')&&q('preset').options.length>1;});
        q('preset').value='0'; q('preset').dispatchEvent(new Event('change',{bubbles:true}));
        await wait(300);
        document.body.setAttribute('data-test',JSON.stringify({ok:true,state:await readAll()}));
      }
    }catch(e){document.body.setAttribute('data-test',JSON.stringify({err:String(e&&e.message||e)}));}
  })();`;
fs.writeFileSync(path.join(OUT, "b.html"), page("", driverB));
const B = launch("b", "file:///" + path.join(OUT, "b.html").replace(/\\/g, "/") + "#zp=" + zpB);
if (!B.ok) throw new Error("phase B failed: " + (B.err || JSON.stringify(B)));

// ---- compare ----
let fails = 0;
const S = x => JSON.stringify(x);
function eq(label, a, b) { const ok = S(a) === S(b); if (!ok) fails++; console.log((ok ? "PASS  " : "FAIL  ") + label + (ok ? "" : "  A=" + S(a) + "  B=" + S(b))); }
function expect(label, got, want) { const ok = S(got) === S(want); if (!ok) fails++; console.log((ok ? "PASS  " : "FAIL  ") + label + (ok ? "  [" + S(want) + "]" : "  want " + S(want) + " got " + S(got))); }

console.log("== A itself applied the intended values (guards against both-sides-wrong) ==");
expect("L0 blend add", A.state.layers[0].blend, "add");
expect("L1 blend diff", A.state.layers[1].blend, "diff");
expect("L2 blend mul", A.state.layers[2].blend, "mul");
expect("L3 blend rgb", A.state.layers[3].blend, "rgb");
expect("L0 rpm custom range", [A.state.layers[0].rpmMin, A.state.layers[0].rpmMax], ["0.5", "7"]);
expect("L0 rpm value", [A.state.layers[0].rpmLo, A.state.layers[0].rpmHi], ["3", "3"]);
expect("L0 pulse shape", A.state.layers[0].pulseRpm, "bounce");
expect("L0 pulse length", A.state.layers[0].plenRpm, "0.44");
expect("L0 palette", A.state.layers[0].palette, "5");
expect("L0 palette reversed", A.state.layers[0].palrev, true);
expect("L0 palette bg", A.state.layers[0].palbg, "white");
expect("L1 muted", A.state.layers[1].mute, "○");
expect("scene filters all on", A.state.scene.flt, { bloom: true, vignette: true, scanlines: true, grain: true, barrel: true });
expect("preset TTL", A.state.scene.ttl, ["45", "90"]);
expect("preset transition", A.state.scene.tdur, ["1.5", "2.5"]);
expect("scene-wide custom range (palcycle max)", A.state.scene.palcycleMax, "20");

console.log("\n== RECEIVER(B) matches SOURCE(A) field-by-field ==");
eq("layer count", A.state.layers.length, B.state.layers.length);
const fields = ["effect", "blend", "gain", "mute", "palette", "palrev", "palbg", "showBox",
  "rpmMin", "rpmMax", "rpmLo", "rpmHi", "ratio", "fade", "camrx", "plenRpm", "pulseRpm"];
for (let k = 0; k < A.state.layers.length; k++)
  for (const f of fields) eq("L" + k + "." + f, A.state.layers[k][f], (B.state.layers[k] || {})[f]);
for (const f of ["ttl", "tdur", "flt", "vignette", "scan", "grain", "barrel", "palcycleMax"])
  eq("scene." + f, A.state.scene[f], B.state.scene[f]);

console.log(fails ? `\n${fails} FAILED` : `\nall share-parity checks passed`);
process.exit(fails ? 1 : 0);
